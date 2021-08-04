const express = require('express');
const app = express();
const PORT = 1137;

app.use(express.static('../three'));

app.listen(PORT, () => console.log(`Server listening on port: ${PORT}`));
