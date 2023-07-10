const axios = require("axios");
const FormData = require("form-data");

async function getPNG(fileName) {
  const formData = new FormData();
  formData.append(
    "instructions",
    JSON.stringify({
      parts: [
        {
          file: "document",
        },
      ],
      output: {
        type: "image",
        format: "jpg",
        quality: 70,
        dpi: 250,
      },
    })
  );
  formData.append("document", fileName);

  try {
    const response = await axios.post(
      "https://api.pspdfkit.com/build",
      formData,
      {
        headers: formData.getHeaders({
          Authorization: `Bearer ${process.env.docxKey}`,
        }),
        responseType: "arraybuffer",
      }
    );

    const imageBuffer = Buffer.from(response.data, "binary");
    return imageBuffer;
  } catch (err) {
    console.log({ error: err.message });
  }
}

module.exports = { getPNG };
