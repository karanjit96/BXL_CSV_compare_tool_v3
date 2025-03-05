/***************************************************
 * GLOBALS
 ***************************************************/

// Each fileData[i] has structure: { carA: { feat1: val, feat2: val, ... }, carB: {}, ... }
let fileData = [ {}, {}, {}, {} ];

// We'll store the "feature order" exactly as they appear in the original file (file1).
let carFeaturesOrder = {};

// File names for display
let fileNames = ["Data 1", "Data 2", "Data 3", "Data 4"];

// Keep track of all cars that appear in file1 (the original)
let allCars = [];
let currentCarIndex = 0;
let allTableRows = [];

// Track whether the user actually uploaded file4
let isFile4Uploaded = false;

// For storing Chart.js instances
let compareChartInstance = null; 
let diffChartInstance = null;


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

  // Must have at least three files
  if (!files[0] || !files[1] || !files[2]) {
    alert("Please upload at least three CSV or Excel files (File1, File2, File3).");
    return;
  }

  isFile4Uploaded = !!files[3];

  // Reset global data
  fileData = [ {}, {}, {}, {} ];
  carFeaturesOrder = {};
  allCars = [];
  currentCarIndex = 0;
  localStorage.clear(); // optional: clear autosaved data

  let readCount = 0;
  const totalToRead = files.filter(f => f).length;

  files.forEach((file, i) => {
    if (!file) return;

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
  });
}

/**
 * After reading all files, build the car list and the initial table.
 */
function finalizeData() {
  // Once all files are read, gather the cars that appear in file1
  allCars = Object.keys(carFeaturesOrder);

  // Update the car selector
  updateCarSelector();

  // Hide chart overlay now that we have data
  document.getElementById("chartOverlay").style.display = "none";

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
 * Parse CSV text (multi-column).
 */
function parseMultiColumnCSV(csvText, fileIndex) {
  const lines = csvText.trim().split("\n");
  if (lines.length < 2) return;

  // Parse the header row
  const headerRow = safeSplitCSVLine(lines[0]);
  const carNames = headerRow.slice(1); // columns after "Feature"

  // Make sure we have data structures for each car in fileData[fileIndex]
  carNames.forEach((car) => {
    if (!fileData[fileIndex][car]) {
      fileData[fileIndex][car] = {};
    }
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

    for (let colIndex = 1; colIndex < row.length; colIndex++) {
      const carName = headerRow[colIndex].trim();
      if (fileData[fileIndex][carName]) {
        const cellValue = row[colIndex].trim();
        fileData[fileIndex][carName][feature] = cellValue;

        // If this is file1 (index=0), record feature order
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
 * Safely splits a CSV line, handling quoted fields.
 */
function safeSplitCSVLine(line) {
  const tokens = line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g);
  if (!tokens) return [];
  return tokens.map((t) => t.replace(/^"|"$/g, "").trim());
}

/**
 * Parse an Excel file (ArrayBuffer) using SheetJS.
 */
function parseExcel(arrayBuffer, fileIndex) {
  const data = new Uint8Array(arrayBuffer);
  const workbook = XLSX.read(data, { type: "array" });

  // Take the first sheet
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];

  // Convert to 2D array
  const sheetData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  parseMultiColumnArray(sheetData, fileIndex);
}

/**
 * Parse a 2D array (already split into rows/columns).
 */
function parseMultiColumnArray(sheetData, fileIndex) {
  if (!sheetData || sheetData.length < 2) return;

  const headerRow = sheetData[0];
  const carNames = headerRow.slice(1);

  carNames.forEach((car) => {
    if (!fileData[fileIndex][car]) {
      fileData[fileIndex][car] = {};
    }
    if (fileIndex === 0 && !carFeaturesOrder[car]) {
      carFeaturesOrder[car] = [];
    }
  });

  for (let i = 1; i < sheetData.length; i++) {
    const row = sheetData[i] || [];
    if (row.length < 2) continue;

    const feature = (row[0] || "").trim();
    if (!feature) continue;

    for (let colIndex = 1; colIndex < row.length; colIndex++) {
      const carName = (headerRow[colIndex] || "").trim();
      if (fileData[fileIndex][carName]) {
        const cellValue = (row[colIndex] || "").toString().trim();
        fileData[fileIndex][carName][feature] = cellValue;

        // If this is file1 (index=0), record feature order
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
  // 1) Update the heading with the car name
  document.getElementById("selectedCarTitle").innerText = `${carName}`;

  // Show/hide the 4th file column based on whether file4 was uploaded
  document.getElementById("file-header4").style.display = isFile4Uploaded ? "" : "none";

  // Update displayed column headers
  document.getElementById("file-header1").innerText = fileNames[0];
  document.getElementById("file-header2").innerText = fileNames[1];
  document.getElementById("file-header3").innerText = fileNames[2];
  document.getElementById("file-header4").innerText = fileNames[3];

  // Grab the features for this car from file1 in the exact original order
  const featureList = carFeaturesOrder[carName] || [];
  const totalFeatures = featureList.length;

  // Clear table
  const tableBody = document.querySelector("#data-table tbody");
  tableBody.innerHTML = "";
  allTableRows = [];

  // KPI counters
  let sameCount = 0;
  let partialCount = 0;
  let diffCount = 0;
  let missingCellCount = 0;

  // Diff counters for files 2,3,4 vs file1
  let diffFile2 = 0, diffFile3 = 0, diffFile4 = 0;
  let compareCount2 = 0, compareCount3 = 0, compareCount4 = 0;

  // Build each row (no pagination)
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

    // Convert empty strings to placeholders
    const transformedValues = rowValues.map((val, colIndex) =>
      val === "" ? `_EMPTY_${rowIndex}_${colIndex}` : val
    );

    // Determine row color category
    const uniqueVals = new Set(transformedValues);
    let rowColorClass = "";
    let finalValue = "";

    // If all non-empty are the same => "green"
    const allNonEmptyAreSame = (
      uniqueVals.size === 1 &&
      ![...uniqueVals][0].startsWith("_EMPTY_")
    );

    if (allNonEmptyAreSame) {
      rowColorClass = "green";
      sameCount++;
      finalValue = rowValues[0];

    } else if (uniqueVals.size === rowValues.length) {
      rowColorClass = "red";
      diffCount++;

    } else {
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
      rowValues.forEach((v) => {
        if (v !== "" && freqMap[v] >= maxFreq) {
          maxFreq = freqMap[v];
          bestVal = v;
        }
      });
      finalValue = bestVal;
    }

    // Compare file2..4 vs file1 if file1 is non-empty
    const valFile1 = rowValues[0];
    if (valFile1) {
      // File2
      if (rowValues[1]) {
        compareCount2++;
        if (rowValues[1] !== valFile1) diffFile2++;
      }
      // File3
      if (rowValues[2]) {
        compareCount3++;
        if (rowValues[2] !== valFile1) diffFile3++;
      }
      // File4
      if (isFile4Uploaded && rowValues[3]) {
        compareCount4++;
        if (rowValues[3] !== valFile1) diffFile4++;
      }
    }

    // Create the table row
    const tr = document.createElement("tr");
    tr.setAttribute("data-feature", feature);

    // Feature cell
    const featureTd = document.createElement("td");
    featureTd.textContent = feature;
    tr.appendChild(featureTd);

    // Data cells (1..4)
    rowValues.forEach((val, colIndex) => {
      const td = document.createElement("td");
      // Inline editing if desired
      const input = document.createElement("input");
      input.type = "text";
      input.value = val;
      input.oninput = () => {
        // Store updated value in local storage if you want
        autosaveEditedData(carName, feature, colIndex, input.value);
      };
      // Color
      if (val === "") {
        td.classList.add("blue");
      } else {
        td.classList.add(rowColorClass);
      }
      td.appendChild(input);
      tr.appendChild(td);
    });

    // Final Data cell
    const finalTd = document.createElement("td");
    const finalInput = document.createElement("input");
    finalInput.type = "text";

    // Check localStorage for a previously saved finalValue
    const savedKey = `finalData_${carName}_${feature}`;
    const savedVal = localStorage.getItem(savedKey);
    if (savedVal !== null) {
      // user had saved an override
      finalValue = savedVal;
    }
    finalInput.value = finalValue;

    // color hints
    if (rowColorClass === "green") {
      finalInput.style.backgroundColor = "#c8e6c9";
    } else if (rowColorClass === "yellow") {
      finalInput.style.backgroundColor = "#fff9c4";
    }

    // On change, autosave to localStorage
    finalInput.oninput = () => {
      localStorage.setItem(savedKey, finalInput.value);
    };

    finalTd.appendChild(finalInput);
    tr.appendChild(finalTd);

    // If partial or diff, show a tooltip explaining which columns differ
    if (rowColorClass === "yellow" || rowColorClass === "red") {
      tr.title = tooltipTextForRow(rowValues, valFile1);
    }

    tableBody.appendChild(tr);
    allTableRows.push(tr);
  });

  // Update KPIs
  document.getElementById("kpi-total").innerText = `Total Features: ${totalFeatures}`;
  document.getElementById("kpi-same").innerText = `Same: ${sameCount}`;
  document.getElementById("kpi-partial").innerText = `Partial: ${partialCount}`;
  document.getElementById("kpi-diff").innerText = `Different: ${diffCount}`;
  document.getElementById("kpi-missing").innerText = `Missing Cells: ${missingCellCount}`;

  // Diff percentages
  function calcDiffPercent(dCount, cCount) {
    if (!cCount) return "0%";
    return ((dCount / cCount) * 100).toFixed(1) + "%";
  }
  const diff2Pct = calcDiffPercent(diffFile2, compareCount2);
  const diff3Pct = calcDiffPercent(diffFile3, compareCount3);
  const diff4Pct = calcDiffPercent(diffFile4, compareCount4);

  document.getElementById("kpi-diff2").innerText = `File2 Diff: ${diff2Pct}`;
  document.getElementById("kpi-diff3").innerText = `File3 Diff: ${diff3Pct}`;
  document.getElementById("kpi-diff4").innerText = `File4 Diff: ${diff4Pct}`;

  // Update the charts
  updateCharts(sameCount, partialCount, diffCount, diff2Pct, diff3Pct, diff4Pct);
}

/**
 * Tooltip for partial/diff rows
 */
function tooltipTextForRow(rowValues, valFile1) {
  if (!valFile1) {
    return "Different from File1 (File1 is empty)";
  }
  const differences = [];
  rowValues.forEach((val, i) => {
    if (i > 0 && val && val !== valFile1) {
      differences.push(`File${i+1} != File1`);
    }
  });
  if (differences.length === 0) return "No differences from File1";
  return differences.join(", ");
}

/**
 * Inline editing for data columns
 */
function autosaveEditedData(carName, feature, fileIndex, value) {
  // If you want to store the user-edited values for the data columns themselves
  localStorage.setItem(`colData_${carName}_${feature}_${fileIndex}`, value);
}


/***************************************************
 * SEARCH / FILTER
 ***************************************************/

function filterFeatures() {
  const searchValue = document.getElementById("searchInput").value.toLowerCase();
  allTableRows.forEach((row) => {
    const rowText = row.innerText.toLowerCase();
    if (!rowText.includes(searchValue)) {
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
 * RESET
 ***************************************************/

function resetAll() {
  if (!confirm("Are you sure you want to reset all data? This clears local storage.")) return;
  // Clear data
  fileData = [ {}, {}, {}, {} ];
  carFeaturesOrder = {};
  allCars = [];
  currentCarIndex = 0;
  allTableRows = [];
  isFile4Uploaded = false;
  localStorage.clear();

  // Clear table
  document.querySelector("#data-table tbody").innerHTML = "";

  // Reset KPI
  document.getElementById("kpi-total").innerText = "Total Features: 0";
  document.getElementById("kpi-same").innerText = "Same: 0";
  document.getElementById("kpi-partial").innerText = "Partial: 0";
  document.getElementById("kpi-diff").innerText = "Different: 0";
  document.getElementById("kpi-missing").innerText = "Missing Cells: 0";
  document.getElementById("kpi-diff2").innerText = "File2 Diff: 0%";
  document.getElementById("kpi-diff3").innerText = "File3 Diff: 0%";
  document.getElementById("kpi-diff4").innerText = "File4 Diff: 0%";

  // Clear the car selector
  document.getElementById("carSelector").innerHTML = "";

  // Show chart overlay again
  document.getElementById("chartOverlay").style.display = "flex";

  // Destroy chart instances if they exist
  if (compareChartInstance) compareChartInstance.destroy();
  if (diffChartInstance) diffChartInstance.destroy();
}


/***************************************************
 * MODAL (Help)
 ***************************************************/

function toggleHelpModal() {
  const modal = document.getElementById("helpModal");
  if (modal.style.display === "none") {
    modal.style.display = "block";
  } else {
    modal.style.display = "none";
  }
}


/***************************************************
 * LOADING OVERLAY
 ***************************************************/

function showLoadingOverlay() {
  document.getElementById("loadingOverlay").style.display = "flex"; 
}

function hideLoadingOverlay() {
  document.getElementById("loadingOverlay").style.display = "none";
}


/***************************************************
 * EXPORT (CSV)
 ***************************************************/

/**
 * Export the current car’s "Final Data" as CSV.
 */
function exportData() {
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

  hideLoadingOverlay();
}

/**
 * Export all cars side-by-side as CSV (one row per feature, columns for each car).
 */
function exportAllData() {
  showLoadingOverlay();

  setTimeout(() => {
    // 1) Header
    let csvContent = "Feature";
    allCars.forEach(carName => {
      csvContent += `,"${carName}"`;
    });
    csvContent += "\n";

    // 2) Gather union of all features
    const allFeaturesSet = new Set();
    allCars.forEach(carName => {
      const flist = carFeaturesOrder[carName] || [];
      flist.forEach(f => allFeaturesSet.add(f));
    });
    const allFeatures = Array.from(allFeaturesSet);

    // 3) For each feature, read final data from DOM by rebuilding each car table
    allFeatures.forEach(feature => {
      let rowData = [`"${feature}"`];

      allCars.forEach(carName => {
        currentCarIndex = allCars.indexOf(carName);
        buildComparisonTableForCar();

        const rowEl = Array.from(document.querySelectorAll("#data-table tbody tr"))
          .find(r => r.cells[0].innerText === feature);

        let finalValue = "";
        if (rowEl) {
          const inputEl = rowEl.cells[rowEl.cells.length - 1].querySelector("input");
          if (inputEl) finalValue = inputEl.value;
        }
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

    hideLoadingOverlay();
  }, 50);
}


/***************************************************
 * EXPORT (Excel)
 ***************************************************/

/**
 * Export the current car’s "Final Data" as Excel.
 */
function exportDataXLSX() {
  showLoadingOverlay();
  setTimeout(() => {
    // Gather data from the current table
    let dataRows = [["Feature", "Final Data"]];
    document.querySelectorAll("#data-table tbody tr").forEach((row) => {
      const feature = row.cells[0].innerText;
      const finalValue = row.cells[row.cells.length - 1].querySelector("input").value;
      dataRows.push([feature, finalValue]);
    });

    // Build workbook
    let wb = XLSX.utils.book_new();
    let ws = XLSX.utils.aoa_to_sheet(dataRows);
    XLSX.utils.book_append_sheet(wb, ws, "FinalData");

    const now = new Date();
    const timestamp = now.toISOString().slice(0, 19).replace("T", "_").replace(/:/g, "-");
    XLSX.writeFile(wb, `final_data_${timestamp}.xlsx`);

    hideLoadingOverlay();
  }, 50);
}

/**
 * Export all cars side-by-side as Excel.
 */
function exportAllDataXLSX() {
  showLoadingOverlay();
  setTimeout(() => {
    // 1) Header
    let header = ["Feature"];
    allCars.forEach(carName => {
      header.push(carName);
    });

    // 2) Gather all features
    const allFeaturesSet = new Set();
    allCars.forEach((carName) => {
      const flist = carFeaturesOrder[carName] || [];
      flist.forEach(f => allFeaturesSet.add(f));
    });
    const allFeatures = Array.from(allFeaturesSet);

    // 3) Build data array
    let dataRows = [header];

    allFeatures.forEach(feature => {
      let row = [feature];
      allCars.forEach(carName => {
        currentCarIndex = allCars.indexOf(carName);
        buildComparisonTableForCar();

        const rowEl = Array.from(document.querySelectorAll("#data-table tbody tr"))
          .find(r => r.cells[0].innerText === feature);

        let finalValue = "";
        if (rowEl) {
          const inputEl = rowEl.cells[rowEl.cells.length - 1].querySelector("input");
          if (inputEl) finalValue = inputEl.value;
        }
        row.push(finalValue);
      });
      dataRows.push(row);
    });

    // 4) Build workbook
    let wb = XLSX.utils.book_new();
    let ws = XLSX.utils.aoa_to_sheet(dataRows);
    XLSX.utils.book_append_sheet(wb, ws, "AllCars");

    const now = new Date();
    const timestamp = now.toISOString().slice(0, 19).replace("T", "_").replace(/:/g, "-");
    XLSX.writeFile(wb, `all_cars_side_by_side_${timestamp}.xlsx`);

    hideLoadingOverlay();
  }, 50);
}


/***************************************************
 * COMPARE ALL CARS - Single Mega Table
 ***************************************************/

/**
 * Compare all cars by building a table of final data for each feature.
 * This now rebuilds the table for each car so we get auto-copied + manual data.
 */
function compareAllCars() {
  if (allCars.length === 0) {
    alert("No cars loaded yet.");
    return;
  }

  // Open a new tab/window for the comparison
  const newWin = window.open("", "_blank");
  newWin.document.write(`
    <html>
    <head>
      <title>Compare All Cars</title>
    </head>
    <body style="font-family:sans-serif;">
      <h2>Compare All Cars - Final Data</h2>
  `);

  // Build the table header
  let tableHTML = `
    <table border='1' cellpadding='5' cellspacing='0' style='border-collapse:collapse;'>
      <thead>
        <tr>
          <th>Feature</th>
  `;
  allCars.forEach((carName) => {
    tableHTML += `<th>${carName}</th>`;
  });
  tableHTML += `</tr></thead><tbody>`;

  // Gather all features (union) from file1’s carFeaturesOrder
  const allFeaturesSet = new Set();
  allCars.forEach((carName) => {
    const flist = carFeaturesOrder[carName] || [];
    flist.forEach((f) => allFeaturesSet.add(f));
  });
  const allFeatures = Array.from(allFeaturesSet);

  // For each feature, read the "Final Data" by rebuilding the table in DOM
  allFeatures.forEach((feature) => {
    tableHTML += `<tr><td>${feature}</td>`;

    allCars.forEach((carName) => {
      currentCarIndex = allCars.indexOf(carName);
      buildComparisonTableForCar();

      const rowEl = Array.from(document.querySelectorAll("#data-table tbody tr"))
        .find(r => r.cells[0].innerText === feature);

      let finalValue = "";
      if (rowEl) {
        const inputEl = rowEl.cells[rowEl.cells.length - 1].querySelector("input");
        if (inputEl) {
          finalValue = inputEl.value;
        }
      }

      tableHTML += `<td>${finalValue}</td>`;
    });

    tableHTML += "</tr>";
  });

  tableHTML += `
      </tbody>
    </table>
  `;

  // Write and close
  newWin.document.write(tableHTML);
  newWin.document.write(`</body></html>`);
  newWin.document.close();
}


/***************************************************
 * CHARTS - Using Chart.js
 ***************************************************/

function updateCharts(sameCount, partialCount, diffCount, diff2Pct, diff3Pct, diff4Pct) {
  // 1) Doughnut chart for same/partial/diff
  const doughnutCtx = document.getElementById("compareChart").getContext("2d");
  if (compareChartInstance) compareChartInstance.destroy();
  compareChartInstance = new Chart(doughnutCtx, {
    type: 'doughnut',
    data: {
      labels: ['Same', 'Partial', 'Different'],
      datasets: [{
        data: [sameCount, partialCount, diffCount],
        backgroundColor: ['#66BB6A', '#FFEE58', '#FFA726']
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' }
      }
    }
  });

  // 2) Bar chart comparing file2/3/4 diffs vs file1
  const barCtx = document.getElementById("diffChart").getContext("2d");
  if (diffChartInstance) diffChartInstance.destroy();

  // Convert "XX%" => XX as number
  const diff2 = parseFloat(diff2Pct);
  const diff3 = parseFloat(diff3Pct);
  const diff4 = parseFloat(diff4Pct);

  diffChartInstance = new Chart(barCtx, {
    type: 'bar',
    data: {
      labels: ['File2', 'File3', 'File4'],
      datasets: [{
        label: '% Different vs File1',
        data: [diff2, diff3, diff4],
        backgroundColor: ['#42A5F5','#AB47BC','#EC407A']
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          max: 100
        }
      },
      plugins: {
        legend: { display: false }
      }
    }
  });
}
