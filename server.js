const app = require('./src/app');
const env = require('./src/config/env');

app.listen(env.port, () => {
  console.log(`Regina Divination Platform running on port ${env.port}`);
});
