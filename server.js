const express = require('express');
const { engine } = require('express-handlebars');
const path = require('path');
const { connect } = require('./db');

const app = express();

app.engine('handlebars', engine());
app.set('view engine', 'handlebars');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: false })); // lê os <form>
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', require('./routes/cliente'));
app.use('/', require('./routes/admin'));

connect()
    .then(() => app.listen(3000, () => console.log('Rodando em http://localhost:3000')))
    .catch((e) => {
        console.error('Falha ao conectar no MongoDB:', e.message);
        process.exit(1);
    });
