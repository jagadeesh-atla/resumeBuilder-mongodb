const express = require("express");
const bodyParser = require("body-parser");
const methodOverride = require("method-override");
const mongoose = require("mongoose");
const multer = require("multer");
const { GridFsStorage } = require("multer-gridfs-storage");
const dotenv = require("dotenv");
const { getPNG } = require("./util.js");
const { createFile } = require("./resume.js");
const morgan = require("morgan");
dotenv.config();
const fs = require("fs");

const app = express();
app.use(methodOverride("_method"));
app.use(morgan("dev"));
app.use(bodyParser.json());

const uri = process.env.dbURI;
const docType =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

mongoose.connect(uri);
const conn = mongoose.connection;

// Check Connection Middleware
app.use((req, res, next) => {
  if (conn.readyState !== 1) {
    conn.once("connected", () => {
      console.log("MongoDB Connected");
      next();
    });
    conn.on("error", (err) => {
      console.error("Error connecting to MongoDB:", err);
      process.exit(1);
    });
  } else {
    next();
  }
});

// Create Bucket
// const dbFiles = await conn.db.collection("fs.files");
let gfs;
app.use((req, res, next) => {
  gfs = new mongoose.mongo.GridFSBucket(conn.db);
  next();
});

// Create Storage
const storage = new GridFsStorage({
  url: uri,
  file: async (req, file) => {
    if (file.mimetype === docType) {
      const filename = file.originalname;
      const count = await conn.db.collection("fs.files").countDocuments();
      const metadata = `template${String(count).padStart(4, 0)}`;
      const fileInfo = {
        filename,
        metadata,
      };
      return fileInfo;
    } else {
      return null;
    }
  },
});

const upload = multer({ storage });

// root route
app.get("/", (req, res) => {
  res.send({ message: "Hi" });
});

// set image from docx to image using an API
const setImage = async (req, res, next) => {
  try {
    const fileStream = gfs.openDownloadStream(req.file.id);
    const image = await getPNG(fileStream);
    const updatedFile = await conn.db
      .collection("fs.files")
      .findOneAndUpdate(
        { _id: req.file.id },
        { $set: { image: image } },
        { new: true }
      );

    if (updatedFile && updatedFile.value) {
      req.file.image = image;
      next();
    } else {
      res.status(500).json({ error: err.message });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// upload template and get image of docx for reference
app.post("/upload", upload.single("template"), setImage, (req, res) => {
  res.json({
    templateId: req.file.metadata,
    id: req.file.id,
    imageData: req.file.image,
  });
  // console.log(req.file);
  // res.setHeader("Content-type", "image/jpeg");
  // res.send(req.file.image);
});

app.get("/templates", async (req, res) => {
  try {
    const files = await conn.db.collection("fs.files").find({}).toArray();
    if (!files || files.length === 0)
      return res.status(404).json({ message: "No files found" });

    const list = files.map((file) => {
      const newFile = {
        templateName: file.metadata,
        templateId: file._id,
      };
      return newFile;
    });

    return res.status(200).json(list);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.get("/image/:id", async (req, res) => {
  try {
    const file = await conn.db
      .collection("fs.files")
      .findOne({ _id: new mongoose.Types.ObjectId(req.params.id) });

    if (!file || file.length === 0)
      return res.status(400).json({ message: "No file found" });

    res.setHeader("Content-type", "image/jpeg");
    res.status(200).send(file.image.buffer);
  } catch (error) {
    console.error("Error retrieving file:", error);
    return res.status(500).json({ error: error.message });
  }
});

function createOutputFileName() {
  let date = new Date();
  let dateString =
    date.getFullYear() +
    "-" +
    ("0" + (date.getMonth() + 1)).slice(-2) +
    "-" +
    ("0" + date.getDate()).slice(-2) +
    "T" +
    ("0" + date.getHours()).slice(-2) +
    "-" +
    ("0" + date.getMinutes()).slice(-2) +
    "-" +
    ("0" + date.getSeconds()).slice(-2);
  return "resume" + dateString + ".pdf";
}

app.post("/resume", async (req, res) => {
  const data = req.body;

  const id = new mongoose.Types.ObjectId(req.body.templateId);
  const template = gfs.openDownloadStream(id);

  delete data.templateId;

  const output = createOutputFileName();
  const result = await createFile(template, data);

  res.set({
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="${output}"`,
  });

  result.writeToStream(res);
});

app.all("*", (req, res) => {
  res.status(200).json({ message: "No route" });
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`Server @ ${port}`);
});
