importScripts("https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js");

self.onmessage = async function (e) {
  const { file, fileType } = e.data;

  try {
    if (fileType === "csv") {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: function (results) {
          validateAndSend(results.data);
        },
        error: function (err) {
          self.postMessage({ success: false, error: err.message });
        },
      });
    } else if (fileType === "json") {
      const text = await file.text();
      const data = JSON.parse(text);
      validateAndSend(Array.isArray(data) ? data : [data]);
    }
  } catch (err) {
    self.postMessage({ success: false, error: err.message });
  }
};

function validateAndSend(rows) {
  if (rows.length > 1000) {
    self.postMessage({
      success: false,
      error: "File exceeds 1,000 rows limit.",
    });
    return;
  }

  const validItems = [];
  const errors = [];

  rows.forEach((row, index) => {
    if (row.japanese && row.reading && row.meaning) {
      validItems.push({
        japanese: String(row.japanese).trim(),
        reading: String(row.reading).trim(),
        meaning: String(row.meaning).trim(),
        type: row.type === "grammar" ? "grammar" : "vocabulary",
        example_sentence: row.example_sentence ? String(row.example_sentence).trim() : null,
        jlpt_level: row.jlpt_level ? String(row.jlpt_level).trim() : null,
        client_import_id: crypto.randomUUID(),
      });
    } else {
      errors.push(`Row ${index + 1}: Missing required fields (japanese, reading, meaning)`);
    }
  });

  self.postMessage({
    success: true,
    items: validItems,
    errors: errors,
  });
}
