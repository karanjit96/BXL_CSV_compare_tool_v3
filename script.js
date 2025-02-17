/***************************************************
 * GLOBALS
 ***************************************************/

/**
 * Each fileData[i] has the structure:
 *   {
 *     carA: { feat1: val, feat2: val, ... },
 *     carB: { ... },
 *     ...
 *   }
 */
let fileData = [ {}, {}, {}, {} ];

// We'll store the "feature order" exactly as they appear in the original file (file1).
let carFeaturesOrder = {};

// File names for display
let fileNames = ["Data 1", "Data 2", "Data 3", "Data 4"];

// Keep track of all cars that appear in file1 (the original)
let allCars = [];
let currentCarIndex = 0;

// For referencing table rows in the search feature
let allTableRows = [];

// Track whether the user actually uploaded file4
let isFile4Uploaded = false;



/***************************************************
 * FILE UPLOAD & PARSING
 ***************************************************/

/**
 * When a file is chosen, update the column header text to show file name.
 */
function updateFileName(index) {
  const fileInput = document.getElementById(`file${index}`);
  const newName = fileInput.files[0] ? fileInput.files[0].name : `Data ${index}`;
  fileNames[index - 1] = newName;
  document.getElementById(`file-header${index}`).innerText = newName;
}

/**
 * Process the files: read them, parse them, then build the table for the first car.
 */
function processFiles() {
  const files = [
    document.getElementById("file1").files[0],
    document.getElementById("file2").files[0],
    document.getElementById("file3").files[0],
    document.getElementById("file4").files[0],
  ];

  // At least three files required
  if (!files[0] || !files[1] || !files[2]) {
    alert("Please upload at least three CSV or Excel files (File1, File2, File3).");
    return;
  }

  // Check if file4 is uploaded
  isFile4Uploaded = !!files[3];

  // Reset global data
  fileData = [ {}, {}, {}, {} ];
  carFeaturesOrder = {};
  allCars = [];
  currentCarIndex = 0;

  let readCount = 0;
  const totalToRead = files.filter(f => f).length;

  files.forEach((file, i) => {
    if (file) {
      // Check the extension
      if (isCSV(file.name)) {
        // Parse as CSV
        const reader = new FileReader();
        reader.onload = (event) => {
          parseMultiColumnCSV(event.target.result, i);
          readCount++;
          if (readCount === totalToRead) {
            finalizeData();
          }
        };
        reader.readAsText(file);
      } else if (isExcel(file.name)) {
        // Parse as Excel
        const reader = new FileReader();
        reader.onload = (event) => {
          parseExcel(event.target.result, i);
          readCount++;
          if (readCount === totalToRead) {
            finalizeData();
          }
        };
        reader.readAsArrayBuffer(file);
      } else {
        alert(`Unsupported file format: ${file.name}. Please upload CSV or Excel files.`);
      }
    }
  });
  
}

/**
 * After reading all files, build the car list and the initial table.
 */
function finalizeData() {
  // Once all files are read, let's finalize allCars
  // We only care about the cars that appeared in file1 (index=0)
  allCars = Object.keys(carFeaturesOrder);

  // Update the car selector
  updateCarSelector();

  // Build the comparison table for the first car
  buildComparisonTableForCar();
}

/**
 * Checks if file is .csv (case-insensitive).
 */
function isCSV(filename) {
  return /\.(csv)$/i.test(filename);
}

/**
 * Checks if file is .xls or .xlsx (case-insensitive).
 */
function isExcel(filename) {
  return /\.(xls|xlsx)$/i.test(filename);
}

/**
 * Parse CSV text (multi-column). If it's the 0th file (index===0), record the
 * exact feature order for each car.
 *
 * CSV format example:
 *   Feature,CarA,CarB,CarC
 *   feat1,valA1,valB1,valC1
 *   feat2,valA2,valB2,valC2
 *   ...
 */
function parseMultiColumnCSV(csvText, fileIndex) {
  const lines = csvText.trim().split("\n");
  if (lines.length < 2) return;

  // Parse the header row
  const headerRow = safeSplitCSVLine(lines[0]);
  // first column is "Feature", subsequent columns are car names
  const carNames = headerRow.slice(1);

  // Make sure we have a data structure for each car in fileData[fileIndex]
  carNames.forEach((car) => {
    if (!fileData[fileIndex][car]) {
      fileData[fileIndex][car] = {};
    }
    // If it's the first/original file, also set up the feature order array
    if (fileIndex === 0 && !carFeaturesOrder[car]) {
      carFeaturesOrder[car] = [];
    }
  });

  // For each subsequent row
  for (let i = 1; i < lines.length; i++) {
    const row = safeSplitCSVLine(lines[i]);
    if (!row || row.length < 2) continue;

    const feature = row[0].trim();
    if (!feature) continue;

    // For each car column
    for (let colIndex = 1; colIndex < row.length; colIndex++) {
      const carName = headerRow[colIndex].trim();
      if (fileData[fileIndex][carName]) {
        const cellValue = row[colIndex].trim();
        fileData[fileIndex][carName][feature] = cellValue;

        // If this is file1 (original) and we haven't recorded this feature yet, record it in order.
        if (fileIndex === 0) {
          const featureList = carFeaturesOrder[carName];
          if (!featureList.includes(feature)) {
            featureList.push(feature);
          }
        }
      }
    }
  }
}

/**
 * Safely splits a single CSV line by commas, handling quoted cells if needed.
 */
function safeSplitCSVLine(line) {
  const tokens = line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g);
  if (!tokens) return [];
  return tokens.map((t) => t.replace(/^"|"$/g, "").trim());
}

/**
 * Parse an Excel file (ArrayBuffer) using SheetJS, then convert it to a 2D array
 * for further processing.
 */
function parseExcel(arrayBuffer, fileIndex) {
  // Read the file using XLSX
  const data = new Uint8Array(arrayBuffer);
  const workbook = XLSX.read(data, { type: "array" });

  // Just take the first sheet
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];

  // Convert the sheet to a 2D array
  // By default, { header: 1 } means the first row is returned as an array of header strings
  const sheetData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  parseMultiColumnArray(sheetData, fileIndex);
}

/**
 * Parse a 2D array (already split into rows/columns).
 *
 * Array format example:
 * [
 *   [ 'Feature', 'CarA', 'CarB', 'CarC' ],
 *   [ 'feat1', 'valA1', 'valB1', 'valC1' ],
 *   [ 'feat2', 'valA2', 'valB2', 'valC2' ],
 *   ...
 * ]
 */
function parseMultiColumnArray(sheetData, fileIndex) {
  if (!sheetData || sheetData.length < 2) return;

  // The first row is the header
  const headerRow = sheetData[0];
  // first column is "Feature", subsequent columns are car names
  const carNames = headerRow.slice(1);

  // Make sure we have a data structure for each car in fileData[fileIndex]
  carNames.forEach((car) => {
    if (!fileData[fileIndex][car]) {
      fileData[fileIndex][car] = {};
    }
    // If it's the first/original file, also set up the feature order array
    if (fileIndex === 0 && !carFeaturesOrder[car]) {
      carFeaturesOrder[car] = [];
    }
  });

  // For each subsequent row
  for (let i = 1; i < sheetData.length; i++) {
    const row = sheetData[i] || [];
    if (row.length < 2) continue;

    const feature = (row[0] || "").trim();
    if (!feature) continue;

    // For each car column
    for (let colIndex = 1; colIndex < row.length; colIndex++) {
      const carName = (headerRow[colIndex] || "").trim();
      if (fileData[fileIndex][carName]) {
        const cellValue = (row[colIndex] || "").toString().trim();
        fileData[fileIndex][carName][feature] = cellValue;

        // If this is file1 (original) and we haven't recorded this feature yet, record in order.
        if (fileIndex === 0) {
          const featureList = carFeaturesOrder[carName];
          if (!featureList.includes(feature)) {
            featureList.push(feature);
          }
        }
      }
    }
  }
}


/***************************************************
 * CAR NAVIGATION & SELECTOR
 ***************************************************/

function updateCarSelector() {
  const selector = document.getElementById("carSelector");
  selector.innerHTML = "";
  allCars.forEach((car, index) => {
    const option = document.createElement("option");
    option.value = index;
    option.textContent = car;
    selector.appendChild(option);
  });
  // Default to first
  selector.value = 0;
}

function onCarSelectionChange() {
  const selector = document.getElementById("carSelector");
  currentCarIndex = parseInt(selector.value, 10) || 0;
  buildComparisonTableForCar();
}

function nextCar() {
  if (allCars.length === 0) return;
  currentCarIndex = (currentCarIndex + 1) % allCars.length;
  document.getElementById("carSelector").value = currentCarIndex;
  buildComparisonTableForCar();
}

function prevCar() {
  if (allCars.length === 0) return;
  currentCarIndex = (currentCarIndex - 1 + allCars.length) % allCars.length;
  document.getElementById("carSelector").value = currentCarIndex;
  buildComparisonTableForCar();
}




/***************************************************
 * BUILD COMPARISON TABLE (FOR SELECTED CAR)
 ***************************************************/

function buildComparisonTableForCar() {
  const carName = allCars[currentCarIndex];
  if (!carName) {
    document.querySelector("#data-table tbody").innerHTML = "";
    return;
  }

  // Show/hide the 4th file column based on isFile4Uploaded
  const fileHeader4 = document.getElementById("file-header4");
  fileHeader4.style.display = isFile4Uploaded ? "" : "none";

  // Update displayed column headers
  document.getElementById("file-header1").innerText = fileNames[0];
  document.getElementById("file-header2").innerText = fileNames[1];
  document.getElementById("file-header3").innerText = fileNames[2];
  document.getElementById("file-header4").innerText = fileNames[3];

  // Grab the features for this car from file1 in the exact original order
  const featureList = carFeaturesOrder[carName] || [];

  // Clear table
  const tableBody = document.querySelector("#data-table tbody");
  tableBody.innerHTML = "";
  allTableRows = [];

  // KPI counters
  let sameCount = 0;
  let partialCount = 0;
  let diffCount = 0;
  let missingCellCount = 0;

  // Diff counters
  let diffFile2 = 0, diffFile3 = 0, diffFile4 = 0;
  let compareCount2 = 0, compareCount3 = 0, compareCount4 = 0;

  // Build each row in the exact order
  featureList.forEach((feature, rowIndex) => {
    // Gather up to 4 values
    const rowValues = [];
    for (let i = 0; i < 4; i++) {
      if (i === 3 && !isFile4Uploaded) break;
      const carObj = fileData[i][carName] || {};
      const val = carObj[feature] || "";
      rowValues.push(val);
    }

    // Count missing
    missingCellCount += rowValues.filter((v) => v === "").length;

    // Convert empty strings to unique placeholders
    const transformedValues = rowValues.map((val, colIndex) =>
      val === "" ? `_EMPTY_${rowIndex}_${colIndex}` : val
    );

    // Determine row color category
    const uniqueVals = new Set(transformedValues);
    let rowColorClass = "";
    let finalValue = "";

    const allNonEmptyAreSame =
      uniqueVals.size === 1 && ![...uniqueVals][0].startsWith("_EMPTY_");

    if (allNonEmptyAreSame) {
      // Green - all same
      rowColorClass = "green";
      sameCount++;
      finalValue = rowValues[0];
    } else if (uniqueVals.size === rowValues.length) {
      // Red - all distinct
      rowColorClass = "red";
      diffCount++;
    } else {
      // Yellow - partial
      rowColorClass = "yellow";
      partialCount++;
      // Pick the most common non-empty value
      const freqMap = {};
      rowValues.forEach((v) => {
        if (v !== "") {
          freqMap[v] = (freqMap[v] || 0) + 1;
        }
      });
      let bestVal = "";
      let maxFreq = 0;
      for (let i = 0; i < rowValues.length; i++) {
        const v = rowValues[i];
        if (v !== "" && freqMap[v] >= maxFreq) {
          maxFreq = freqMap[v];
          bestVal = v;
        }
      }
      finalValue = bestVal;
    }

    // Compare file2..4 vs file1 if file1 is non-empty
    const valFile1 = rowValues[0];
    if (valFile1) {
      // file2
      if (rowValues[1]) {
        compareCount2++;
        if (rowValues[1] !== valFile1) diffFile2++;
      }
      // file3
      if (rowValues[2]) {
        compareCount3++;
        if (rowValues[2] !== valFile1) diffFile3++;
      }
      // file4
      if (isFile4Uploaded && rowValues[3]) {
        compareCount4++;
        if (rowValues[3] !== valFile1) diffFile4++;
      }
    }

    // Create table row
    const tr = document.createElement("tr");
    tr.setAttribute("data-feature", feature);

    // Feature cell
    const featureTd = document.createElement("td");
    featureTd.textContent = feature;
    tr.appendChild(featureTd);

    // Data cells
    rowValues.forEach((val) => {
      const td = document.createElement("td");
      td.textContent = val;
      if (val === "") {
        td.classList.add("blue");
      } else {
        td.classList.add(rowColorClass);
      }
      tr.appendChild(td);
    });

    // Final (editable) cell
    const finalTd = document.createElement("td");
    const input = document.createElement("input");
    input.type = "text";
    if (rowColorClass === "green") {
      input.value = finalValue;
      input.style.backgroundColor = "#c8e6c9"; // light green
    } else if (rowColorClass === "yellow" && finalValue) {
      input.value = finalValue;
      input.style.backgroundColor = "#fff9c4"; // light yellow
    }
    finalTd.appendChild(input);
    tr.appendChild(finalTd);

    tableBody.appendChild(tr);
    allTableRows.push(tr);
  });

  // Update KPIs
  document.getElementById("kpi-total").innerText = `Total Features: ${featureList.length}`;
  document.getElementById("kpi-same").innerText = `Same: ${sameCount}`;
  document.getElementById("kpi-partial").innerText = `Partial: ${partialCount}`;
  document.getElementById("kpi-diff").innerText = `Different: ${diffCount}`;
  document.getElementById("kpi-missing").innerText = `Missing Cells: ${missingCellCount}`;

  // Diff percentages
  function calcDiffPercent(dCount, cCount) {
    if (!cCount) return "0%";
    return ((dCount / cCount) * 100).toFixed(1) + "%";
  }
  document.getElementById("kpi-diff2").innerText = `File2 Diff: ${calcDiffPercent(diffFile2, compareCount2)}`;
  document.getElementById("kpi-diff3").innerText = `File3 Diff: ${calcDiffPercent(diffFile3, compareCount3)}`;
  document.getElementById("kpi-diff4").innerText = `File4 Diff: ${calcDiffPercent(diffFile4, compareCount4)}`;


}


/***************************************************
 * SEARCH / FILTER
 ***************************************************/

function filterFeatures() {
  const searchValue = document.getElementById("searchInput").value.toLowerCase();
  allTableRows.forEach((row) => {
    const featureName = row.getAttribute("data-feature").toLowerCase();
    if (!featureName.includes(searchValue)) {
      row.style.display = "none";
    } else {
      row.style.display = "";
    }
  });
}


/***************************************************
 * DARK MODE
 ***************************************************/

function toggleDarkMode() {
  document.body.classList.add("pixelate-transition");

  setTimeout(() => {
    document.body.classList.toggle("dark-mode");
  }, 200);

  setTimeout(() => {
    document.body.classList.remove("pixelate-transition");
  }, 600);
}
/***************************************************
 * Loading overlay
 ***************************************************/

function showLoadingOverlay() {
  document.getElementById("loadingOverlay").style.display = "flex"; 
}

function hideLoadingOverlay() {
  document.getElementById("loadingOverlay").style.display = "none";
}


/***************************************************
 * EXPORT
 ***************************************************/

function exportData() {
  // Show the overlay
  showLoadingOverlay();
  let csvContent = "Feature,Final Data\n";
  document.querySelectorAll("#data-table tbody tr").forEach((row) => {
    const feature = row.cells[0].innerText;
    const finalValue = row.cells[row.cells.length - 1].querySelector("input").value;
    csvContent += `"${feature}","${finalValue}"\n`;
  });

  const blob = new Blob([csvContent], { type: "text/csv" });
  const a = document.createElement("a");

  const now = new Date();
  const timestamp = now.toISOString().slice(0, 19).replace("T", "_").replace(/:/g, "-");
  a.download = `final_data_${timestamp}.csv`;
  a.href = URL.createObjectURL(blob);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Hide the overlay
  hideLoadingOverlay();
}

/**
 * Exports all cars in columns. Each row = a Feature, and each column = that Feature’s Final Data 
 * for a particular car. Features that appear in multiple cars line up in the same row.
 *
 * Note: This approach temporarily re-renders the table for each car in order to read 
 * the "Final Data" inputs from the DOM. For large datasets, consider storing user-edited
 * values in an array/object, so you don't have to rebuild the table each time.
 */
function exportAllData() {
  // Show the overlay
  showLoadingOverlay();

  setTimeout(() => {
  // 1) Build CSV header: "Feature" + each car name
  let csvContent = "Feature";
  allCars.forEach(carName => {
    csvContent += `,"${carName}"`;
  });
  csvContent += "\n";

  // 2) Gather *all* features (union) from file1’s carFeaturesOrder
  //    (If you only want the features from file1, or from every file, adjust accordingly.)
  const allFeaturesSet = new Set();
  allCars.forEach(carName => {
    const featureList = carFeaturesOrder[carName] || [];
    featureList.forEach(f => allFeaturesSet.add(f));
  });
  const allFeatures = Array.from(allFeaturesSet);

  // 3) For each feature, we’ll add one CSV row
  allFeatures.forEach(feature => {
    // Start row with "Feature" name
    let rowData = [`"${feature}"`];

    // For each car, temporarily render that car in the table, then read the final data for this feature
    allCars.forEach(carName => {
      // Switch the table to the current car so we can read the Final Data input from the DOM
      currentCarIndex = allCars.indexOf(carName);
      buildComparisonTableForCar();

      // Find the row (tr) for this feature
      const rowEl = Array.from(document.querySelectorAll("#data-table tbody tr"))
        .find(r => r.cells[0].innerText === feature);

      // If row found, grab the user-edited value from the last cell’s <input>
      let finalValue = "";
      if (rowEl) {
        const inputEl = rowEl.cells[rowEl.cells.length - 1].querySelector("input");
        if (inputEl) finalValue = inputEl.value;
      }

      // Push quoted finalValue to CSV row
      rowData.push(`"${finalValue}"`);
    });

    csvContent += rowData.join(",") + "\n";
  });

  // 4) Download
  const blob = new Blob([csvContent], { type: "text/csv" });
  const a = document.createElement("a");
  const now = new Date();
  const timestamp = now.toISOString().slice(0, 19).replace("T", "_").replace(/:/g, "-");
  a.download = `all_cars_side_by_side_${timestamp}.csv`;
  a.href = URL.createObjectURL(blob);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Hide the overlay
  hideLoadingOverlay();
}, 50);
}

