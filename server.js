'use strict';
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const passport = require('passport');
const { STRIPE_SECRET_KEY } = require('./config');
const stripe = require("stripe")(STRIPE_SECRET_KEY);
const { router: usersRouter } = require('./users');
const { router: authRouter, localStrategy, jwtStrategy } = require('./auth');
const { router: historyRouter } = require('./purchase-history');
const { PurchaseHistory } = require('./purchase-history/models');
const app = express();

mongoose.Promise = global.Promise;

const { PORT, DATABASE_URL } = require('./config');
const cors = require('cors');
const { CLIENT_ORIGIN } = require('./config');

app.use(require("body-parser").text());
app.use(require("body-parser").json());

app.use(
  cors({
    origin: CLIENT_ORIGIN
  })
);

passport.use(localStrategy);
passport.use(jwtStrategy);

app.use('/api/users/', usersRouter);
app.use('/api/auth/', authRouter);
app.use('/api/purchase-history/', historyRouter);

app.get('/api/status', (req, res) => {
  res.json({ ok: true });
});

app.get('/api/transaction-history', (req, res) => {
  PurchaseHistory
    .find()
    .then(items => {
      res.json(items);
    })
    .catch(err => {
      console.error(err);
      res.status(500).json({ error: 'something went wrong' });
    });
});

app.post('/logout', (req, res) => {
  res.clearCookie('id_token');
  res.redirect('/');
});

//stripe charges get posted here
app.post('/api/charge', async (req, res) => {
  try {
    let { status } = await stripe.charges.create({
      amount: req.body.product,
      currency: "usd",
      description: `${req.body.description} - Ballet Body by Jasmin`,
      source: req.body.token
    });

    res.json({ status });
  }
  catch (err) {
    res.status(500).end();
    console.log(err)
  }
});


let server;

function runServer(databaseUrl, port = PORT) {

  return new Promise((resolve, reject) => {
    mongoose.connect(databaseUrl, err => {
      if (err) {
        return reject(err);
      }
      server = app.listen(port, () => {
        console.log(`Your app is listening on port ${port}`);
        resolve();
      })
        .on('error', err => {
          mongoose.disconnect();
          reject(err);
        });
    });
  });
}

function closeServer() {

  return mongoose.disconnect().then(() => {
    return new Promise((resolve, reject) => {
      console.log('Closing server');
      server.close(err => {
        if (err) {
          return reject(err);
        }
        resolve();
      });
    });
  });
}

if (require.main === module) {
  runServer(DATABASE_URL).catch(err => console.error(err));
}

module.exports = { app, runServer, closeServer };
