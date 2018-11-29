'use strict'

var bcrypt = require('bcrypt-nodejs');
var mongoosePaginate = require('mongoose-pagination');
var fs = require('fs');
var path = require('path');

var User = require('../models/user');
var Follow = require('../models/follow');
var Publication = require('../models/publication');
var jwt = require('../services/jwt');

//Métodos de prueba
function home(req, res) {
	res.status(200).send({
		message: 'Hola Mundo'
	});
}

function pruebas(req, res) {
	console.log(req);
	res.status(200).send({
		message: 'Acción de prueba en el servidor'
	});
}

//Registro
function saveUser(req, res) {
	var params = req.body;
	var user = new User();

	if (params.name && params.surname && params.nick &&
		params.email && params.password) {

		user.name = params.name;
		user.surname = params.surname;
		user.nick = params.nick;
		user.email = params.email;
		user.role = 'ROLE_USER';
		user.image = null;

		//Controlar usuarios duplicados
		User.find({
			$or: [
				{ email: user.email.toLowerCase() },
				{ nick: user.nick.toLowerCase() }
			]
		}).exec((err, users) => {

			if (err) return res.status(500).send({ message: 'Error en la petición de usuario!' });

			if (users && users.length >= 1) {
				return res.status(200).send({ message: 'Usuario ya existe!' });
			} else {

				//Cifrar password
				bcrypt.hash(params.password, null, null, (err, hash) => {
					user.password = hash;

					user.save((err, userStored) => {
						if (err) return res.status(500).send({ message: 'Error al guardar el usuario!' });

						if (userStored) {
							res.status(200).send({ user: userStored });
						} else {
							res.status(404).send({ message: 'No se ha registrado el usuario!' });
						}
					});
				});
			}
		});
	}
	else {
		res.status(200).send({ message: 'Faltan datos obligatorios!' });
	}

}

//Login
function loginUser(req, res) {
	var params = req.body;

	var email = params.email;
	var password = params.password;

	User.findOne({ email: email }, (err, user) => {
		if (err) return res.status(500).send({ message: 'Error en la petición' });

		if (user) {
			bcrypt.compare(password, user.password, (err, check) => {
				if (check) {
					//devolver datos de usurio
					if (params.gettoken) {
						//generar token
						return res.status(200).send({
							token: jwt.createToken(user)
						});
					} else {
						user.password = undefined;
						return res.status(200).send({ user });
					}
				} else {
					return res.status(404).send({ message: 'El usuario no se ha podido identificar' });
				}
			})
		} else {
			return res.status(404).send({ message: 'El usuario no se ha podido identificar' });
		}
	})
}

// get Datos de 1 usuario
function getUser(req, res) {
	var userId = req.params.id;

	User.findById(userId, (err, user) => {
		if (err) return res.status(500).send({ message: 'Error en la petición' });

		if (!user) return res.status(404).send({ message: 'El usuario no existe' });

		followThisUser(req.user.sub, userId).then((value) => {

			user.password = undefined
			return res.status(200).send({
				user,
				following: value.following,
				followed: value.followed
			});
		});
	});
}

async function followThisUser(identity_user_id, user_id) {
	var following = await Follow.find( await { "user": identity_user_id, "followed": user_id }).exec((err, follow) => {
		if (err) return handleError(err);
		return follow;
	});

	var followed = await Follow.find( await { "user": user_id, "followed": identity_user_id }).exec((err, follow) => {
		if (err) return handleError(err);
		return follow;
	});

	return {
		following: following,
		followed: followed
	}
}

async function followUserIds(user_id) {
	var following = await Follow.find({ "user": user_id }).select({ '_id': 0, '__v': 0, 'user': 0 }).exec((err, followeds) => {
		if (err) return handleError(err);
		return followeds;
	});

	var followed = await Follow.find({ "followed": user_id }).select({ '_id': 0, '__v': 0, 'followed': 0 }).exec((err, users) => {
		if (err) return handleError(err);
		return users;
	});

	console.log("following: " + following);
	console.log("followed: " + followed);

	// Procesar following ids
	var following_clean = [];

	following.forEach((follow) => {
		console.log("forEach: " + follow.followed);
		following_clean.push(follow.followed);
	});

	// Procesar followed ids
	var followed_clean = [];

	followed.forEach((follow) => {
		followed_clean.push(follow.user);
	});
	console.log("followeb: " + followeb);

	return {
		following: following_clean,
		followed: followed_clean
	}

}

//lista pagina
function getUsers(req, res) {
	var identity_user_id = req.user.sub;

	var page = 1;

	if (req.params.page) {
		page = req.params.page;
	}

	var itemsPerPage = 5;

	User.find().sort('_id').paginate(page, itemsPerPage, (err, users, total) => {

		if (err) return res.status(500).send({ message: 'Error en la petición' });

		if (!users) return res.status(404).send({ message: 'No se hallo usuarios' });

		followUserIds(identity_user_id).then((value) => {

			return res.status(200).send({
				users,
				users_following: value.following,
				users_follow_me: value.followed,
				total,
				pages: Math.ceil(total / itemsPerPage)
			});
		});

	});

}

function getCounters(req, res) {
	var userId = req.user.sub;
	if (req.params.id) {
		userId = req.params.id;
	}

	getCountFollow(userId).then((value) => {
		return res.status(200).send(value);
	});
}

async function getCountFollow(user_id) {
	var following = await Follow.count({ "user": user_id }).exec((err, count) => {
		if (err) return handleError(err);
		return count;
	});

	var followed = await Follow.count({ "followed": user_id }).exec((err, count) => {
		if (err) return handleError(err);
		return count;
	});

	return {
		following: following,
		followed, followed
	}

}

// update user
function updateUser(req, res) {
	var userId = req.params.id;
	var update = req.body;

	//borrar propiedad password
	delete update.password;

	if (userId != req.user.sub) {
		return res.status(500).send({ message: 'No tiene permiso de actualizar datos del usuario' });
	}

	User.findByIdAndUpdate(userId, update, { new: true }, (err, userUpdated) => {
		if (err) return res.status(500).send({ message: 'Error en la petición' });

		if (!userUpdated) return res.status(404).send({ message: 'No se ha podido actualizar los datos' });

		return res.status(200).send({ user: userUpdated });
	});

}

// subir imagenes/avatar de usuario
function uploadImage(req, res) {
	var userId = req.params.id;


	if (req.files) {
		var file_path = req.files.image.path;
		console.log(file_path);
		var file_split = file_path.split('\\');
		console.log(file_split);
		var file_name = file_split[2];

		console.log(file_name);

		var ext_split = file_name.split('\.');
		console.log(ext_split);

		var file_ext = ext_split[1];
		console.log(file_ext);

		if (userId != req.user.sub) {
			return removeFileUpload(res, file_path, 'No tienes permiso para actualiar los datos del usuario');
		}

		//aca controlar tipo de imagenes.
		if (file_ext == 'png' || file_ext == 'jpg' || file_ext == 'jpeg' || file_ext == 'gif') {
			//Actualizar documento
			User.findByIdAndUpdate(userId, { image: file_name }, { new: true }, (err, userUpdated) => {
				if (err) return res.status(500).send({ message: 'Error en la petición' });

				if (!userUpdated) return res.status(404).send({ message: 'No se ha podido actualizar los datos' });

				return res.status(200).send({ user: userUpdated });

			});
		}
		else {
			return removeFileUpload(res, file_path, 'Extensión no válida');
		}

	} else {
		return res.status(200).send({ message: 'No se han subido imagenes' });
	}
}

function removeFileUpload(res, file_path, message) {
	fs.unlink(file_path, (err) => {
		return res.status(200).send({ message: message });
	});
}

function getImageFile(req, res) {
	var image_file = req.params.imageFile;
	var path_file = './uploads/users/' + image_file;

	fs.exists(path_file, (exists) => {
		if (exists) {
			res.sendFile(path.resolve(path_file));
		} else {

			res.status(200).send({ message: 'No existe la imagen...' });
		}
	});
}


module.exports = {
	home,
	pruebas,
	saveUser,
	loginUser,
	getUser,
	getUsers,
	getCounters,
	updateUser,
	uploadImage,
	getImageFile
}