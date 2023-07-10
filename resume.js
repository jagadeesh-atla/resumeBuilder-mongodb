const PDFServicesSdk = require("@adobe/pdfservices-node-sdk");
const dotenv = require("dotenv");
dotenv.config();

const credentials =
  PDFServicesSdk.Credentials.servicePrincipalCredentialsBuilder()
    .withClientId(process.env.clientID)
    .withClientSecret(process.env.clientSecret)
    .build();

// Create an ExecutionContext using credentials
const executionContext = PDFServicesSdk.ExecutionContext.create(credentials);

async function createFile(template, data) {
  const jsonInput = data;

  const documentMerge = PDFServicesSdk.DocumentMerge,
    documentMergeOptions = documentMerge.options,
    options = new documentMergeOptions.DocumentMergeOptions(
      jsonInput,
      documentMergeOptions.OutputFormat.PDF
    );

  // Create a new operation instance using the options instance.
  const documentMergeOperation = documentMerge.Operation.createNew(options);

  // Set operation input document template from a source file.
  const input = PDFServicesSdk.FileRef.createFromStream(
    template,
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );
  documentMergeOperation.setInput(input);

  try {
    const result = await documentMergeOperation.execute(executionContext);
    return result;
  } catch (err) {
    console.log({ error: err.message });
  }
}

module.exports = { createFile };
