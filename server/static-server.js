const express = require('express');
const app = express();
const PORT = 1337;

app.use(express.static('../three'));

app.listen(PORT,'0.0.0.0', () => console.log(`Server listening on port: ${PORT}`));