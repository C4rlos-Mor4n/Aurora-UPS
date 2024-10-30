import mongoose from "mongoose";
import config from "../../config";

const mongoURI = config.MONGO_URI;

mongoose.connect(mongoURI);

const userSchema = new mongoose.Schema({
  number: String,
  username: String,
  password: String,
  cookies: [
    {
      name: String,
      value: String,
      domain: String,
      path: String,
      expires: Number,
      httpOnly: Boolean,
      secure: Boolean,
    },
  ],
});

const User = mongoose.model("User", userSchema);

const urlSchema = new mongoose.Schema({
  url: String,
  name: String,
});

const Url = mongoose.model("Url", urlSchema);

const taskSchema = new mongoose.Schema({
  name: String,
  fecha: String,
  hora: String,
  notifiedInitially: { type: Boolean, default: false },
  notifiedBeforeDeadline: { type: Boolean, default: false },
  userPhone: String, // Identificación del usuario
});

const Task = mongoose.model("Task", taskSchema);

export { User, Url, Task };
