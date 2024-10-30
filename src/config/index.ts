import dotenv from "dotenv";
dotenv.config();

export default {
  PORT: process.env.PORT ?? 3008,
  MONGO_URI: process.env.MONGO_URI,
  API_URL: process.env.API_URL,
  HOST_MAIL: process.env.HOST_MAIL,
  PORT_MAIL: process.env.PORT_MAIL,
  USER_MAIL: process.env.USER_MAIL,
  PASS_MAIL: process.env.PASS_MAIL,
};
