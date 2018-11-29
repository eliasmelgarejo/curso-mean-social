'use strict'

var path = require('path');
var fs = require('fs');
var moment = require('moment');
var mongoosePaginate = require('mongoose-pagination');

var Publication = require('../models/publication');
var User = require('../models/user');
var Follow = require('../models/follow');

function probando(req, res) {
    res.status(200).send({
        message: "Hola desde Cotrolador Publication"
    });
}

function savePublication(req, res) {
    var params = req.body;

    if (!params.text) return res.status(200).send({ message: 'Debes enviar un texto!!' });

    var publication = new Publication();
    publication.text = params.text;
    publication.file = 'null';
    publication.user = req.user.sub;
    publication.create_at = moment().unix();

    publication.save((err, publicationStored) => {
        if (err) return res.status(500).send({ message: 'Error al guardar la publicación' });

        if (!publicationStored) return res.status(404).send({ message: 'La publicación No ha sido guardada!' });

        return res.status(200).send({ publication: publicationStored });
    });
}

function getPublications(req, res) {
    var page = 1;
    if (req.params.page) {
        page = req.params.page;
    }
    var itemPerPage = 4;

    Follow.find({ user: req.user.sub }).populate('followed').exec((err, follws) => {
        if (err) returnres.status(500).send({ message: 'Error al devolver el seguimiento' });

        var follows_clean = [];

        follws.forEach((follow) => {
            follows_clean.push(follow.followed);
        });

        Publication.find({ user: { "$in": follows_clean } }).sort('-create_at').populate('user').paginate(page, itemPerPage, (err, publications, total) => {
            if (err) returnres.status(500).send({ message: 'Error al devolver el publicaciones' });

            if (!publications) returnres.status(404).send({ message: 'No hay publicaciones' });

            return res.status(200).send({
                total_items: total,
                pages: Math.ceil(total / itemPerPage),
                page: page,
                publications
            })
        });
    });
}

function getPublication(req, res) {
    var publicationId = req.params.id;

    Publication.findById(publicationId, (err, publication) => {
        if (err) returnres.status(500).send({ message: 'Error al devolver el publicaciones' });

        if (!publication) returnres.status(404).send({ message: 'No existe la publicación' });

        return res.status(200).send({ publication });
    });
}

function deletePublication(req, res) {
    var publicationId = req.params.id;

    Publication.find({ 'user': req.user.sub, '_id': publicationdId }).remove((err, publicationRemoved) => {
        if (err) return res.status(500).send({ message: 'Error al borrar la publicación' });

        if (!publicationRemoved) return res.status(404).send({ message: 'No se ha borrado la publicación' });

        return res.status(200).send({ message: 'Publicación eliminada' });
    });
}

module.exports = {
    probando,
    savePublication,
    getPublications,
    getPublication,
    deletePublication
}