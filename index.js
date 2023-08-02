const express = require('express');
const cors = require('cors'); // Acces-Allow-Headers
const bcrypt = require('bcryptjs'); // Crypter les mot de passe
const mongoose = require('mongoose'); // DB MANAGE
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken'); // Pour les token
const multer = require('multer');
const User = require('./models/User'); // Table User
const Post = require('./models/Post'); // Table Post
const fs = require('fs'); // File system pour rename
require('dotenv').config() // Pour les variable d'environnement

// Init express
const app = express();

// Connexion à la DB
mongoose.connect(process.env.MONGO_DB);


// Système pour upload avec la limite autoriser !
const uploadMiddleware = multer({ 
  dest: 'uploads',
  limits: {
    fieldNameSize: 99999, // Ajustez la taille maximale du nom du champ
    fieldSize: 99999 * 99999, // Ajustez la taille maximale du champ
  } // Limite de 1 Go (ou une valeur plus grande si nécessaire)
}); // Pour upload les images dans le dossier uploads


// Cors pour les FETCH
app.use(cors({
    credentials:true, // Pour autosier les credentials pour les cookies
    origin: process.env.FRONT_HOST, // Lien de l'app FRONT
}));

// Use json()
app.use(express.json());



// Pour les cookies
app.use(cookieParser())

// PORT
app.listen(4000);

// Générer un salt aléatoire pour le mot de passe
const salt = bcrypt.genSaltSync(10);

// Gérer une clé secrete pour la connexion 
const secret = 'sfsf858g1e5e8zacve8s63z';

//Pour utiliser les images uploads coté server vers le front
app.use('/uploads', express.static(__dirname + '/uploads'))


app.get('/', (req, res) => {
    res.json('Home API')
})

// INSCRIPTION
app.post('/register', async (req, res) => {
    const { username, password } = req.body; // Récupére les données entrer
    try {
        // Crée dans notre model userDoc un user via .create
        const userDoc = await User.create({
            username,
            password:bcrypt.hashSync(password, salt), // on passe le mot de passe + le salt
        });
        res.json(userDoc);
    } catch (e) {
        res.status(400).json(e);
    }
   
});


//CONNEXION
app.post('/login', async (req, res) => {
    const { username, password } = req.body; // Récupére les données

    // Vérification de l'utilisateur via l'username (userDoc qui est le model)
    const userDoc = await User.findOne({ username: username })
    // Vérifier si l'utilisateur existe
    if (!userDoc) {
        return res.status(400).json('Mauvais identifiants');
    }
    // Comparer le mot de passe entrer par l'utilisateur au mot de passe de la DB
    const passOk = bcrypt.compareSync(password, userDoc.password)
    // Crée un token une fois que le mot de passe est OK
    if (passOk) {
        // Paramètre de connexion : l'username, l'id, et une clef secrete
        // Un autre paramètre pour les erreur et l'ajout de token
        jwt.sign({ username, id: userDoc._id }, secret, {}, (err, token) => {
            if (err) throw err;
            // On crée un cookie et on lui attribut la valeur du token générer
            res.cookie('token', token).json({
                id: userDoc._id,
                username
            })
        })
    } else {
        res.status(400).json('Mauvais identifiants')
    }
})

// Vérification si un utilisateur est connecter
app.get('/profile', (req, res) => {
    const { token } = req.cookies; // On grabb notre token génerer

    // On vérifie via le token, la valeur de info est l'information de l'user (username & l'id)
    jwt.verify(token, secret, {}, (err, info) => {
        if (err) throw err;
        res.json(info);
    })
    res.json(req.cookies);
})


// Déconnexion, on attribut nos cookie à un emptry string
app.post('/logout', (req, res) => {
    res.cookie('token', '').json('Suppression')
})


// Création d'un article
// On utilise multer pour les images
app.post('/post', uploadMiddleware.single('file'), async (req, res) => {


    // Système pour les fichiers(images) 
    const { originalname, path } = req.file; // On récupère le nom du fichier, et le chemin
    const fichier = originalname.split('.'); // On coupe le nom avec un .
    const extension = fichier[fichier.length - 1]; // Pour avoir l'extention
    const newPath = path + '.' + extension; // Nouveau chemin
    fs.renameSync(path, newPath); // On utilise FS

    const { token } = req.cookies; // On grabb notre token génerer
    
     // On vérifie via le token, la valeur de info est l'information de l'user (l'id)
    // Ceci est pour ajouter l'id de l'user à la création de l'article dans le champ author
    jwt.verify(token, secret, {},  async (err, info) => {
        if (err) throw err;

            // Upload l'article dans la DB
            const { title, summary, content } = req.body;
            const postDoc = await Post.create({
                title,
                summary,
                content,
                cover: newPath,
                author:info.id, // On récupère l'id via info passer dans verify()
        });
        
           res.json(postDoc);
    })
     
})


// Display les articles avec le nom de l'auteur
app.get('/post', async (req, res) => {
    
    const PAGE_SIZE = 4; // 4 article par page
    const page = parseInt(req.query.page || '0');
    const total = await Post.countDocuments({});
    const posts = await Post.find().limit(PAGE_SIZE).skip(PAGE_SIZE * page);

    res.json({
        totalPages: Math.ceil(total / PAGE_SIZE),
        posts
    })
})


//Display 1 seul article via son ID
app.get('/post/:id', async (req, res) => {
    const { id } = req.params;
    const postDoc = await Post.findById(id).populate('author', ['username']);
    res.json(postDoc);
})


// Modifer un article
app.put('/post', uploadMiddleware.single('file'), async (req, res) => {

    let newPath = null; // De base l'image est null car on ne change pas

    if (req.file) {
    // Système pour les fichiers(images) 
    const { originalname, path } = req.file; // On récupère le nom du fichier, et le chemin
    const fichier = originalname.split('.'); // On coupe le nom avec un .
    const extension = fichier[fichier.length - 1]; // Pour avoir l'extention
    newPath = path + '.' + extension; // Nouveau chemin
    fs.renameSync(path, newPath); // On utilise FS
    }

    //Grabb cookie token
    const { token } = req.cookies;

    // On vérifie l'utilisateur
    jwt.verify(token, secret, {},  async (err, info) => {
          if (err) throw err;
          const {id, title, summary, content } = req.body;
          const postDoc = await Post.findById(id);
          const isAuthor = JSON.stringify(postDoc.author) === JSON.stringify(info.id);
        
        //Si ce n'est pas l'auteur
          if (!isAuthor) {
            return res.status(400).json("Tu n'est pas l'auteur")
          }
        
        // On update l'article
          await postDoc.updateOne({
              title,
              summary,
              content,
              cover: newPath ? newPath : postDoc.cover
          });
          
           res.json(postDoc);
    })

})


// Supprimer un article via son ID
app.delete('/post/:id', (req, res) => {
    Post.findByIdAndDelete({ _id: req.params.id })
        .then(result => res.json("Success"))
        .catch(err => res.json(err))
})


