/* eslint-disable */
import 'dotenv/config';
import axios from 'axios';

module.exports = async function () {
  // Configure axios for tests to use. Mirrors global-setup.ts: defaults to
  // API_PORT from .env (what the api process actually binds to), PORT still
  // wins if explicitly set.
  const host = process.env.HOST ?? 'localhost';
  const port = process.env.PORT ?? process.env.API_PORT ?? '3000';
  axios.defaults.baseURL = `http://${host}:${port}`;
};
