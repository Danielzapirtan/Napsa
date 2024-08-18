const canvas = document.getElementById("chart");
const context = canvas.getContext("2d");
let stockData;

let amount;
let buyDate;
let buyPrice;
let expectEntry;
let soldFinal;
let stopLoss;
let table;
let tradeIndex;

document.getElementById("stockTicker").value = "AAPL";
downloadJSON();

function createTable(jsonString) {
  // Parse the JSON string into a JavaScript object
  const jsonData = JSON.parse(jsonString);

  // Get the table element
  const table = document.createElement("table");

  // Create the header row
  const headerRow = table.insertRow();

  // Get the field names from the first object
  const fields = Object.keys(jsonData[0]);

  // Create header cells
  fields.forEach((field) => {
    const th = document.createElement("th");
    th.textContent = field;
    headerRow.appendChild(th);
  });

  // Create table rows and cells
  jsonData.forEach((row) => {
    const newRow = table.insertRow();
    fields.forEach((field) => {
      const cell = newRow.insertCell();
      cell.textContent = row[field];
    });
  });

  return table;
}

const tabs = document.querySelectorAll(".tab");
const tabContent = document.querySelectorAll(".tab-pane");

function showTab(n) {
  tabs.forEach((tab) => {
    tab.classList.remove("active");
  });
  tabs[n].classList.add("active");
  tabContent.forEach((content) => {
    content.classList.remove("active");
  });
  tabContent[n].classList.add("active");
}

// Initial tab
showTab(0);

tabs.forEach((tab, index) => {
  tab.addEventListener("click", () => {
    showTab(index);
  });
});

// TODO Increase readability

// Whether we may buy
function condEntry() {
  try {
    // If second green bar
    if (stockData[tradeIndex].low > stockData[tradeIndex - 1].low)
      if (stockData[tradeIndex - 1].low > stockData[tradeIndex - 2].low)
        if (stockData[tradeIndex - 2].low < stockData[tradeIndex - 3].low)
          return 1;
  } catch { }
  return 0;
}

// Whether we may sell
function condExit() {
  try {
    // On SL (stop loss)
    if (stockData[tradeIndex].low < stopLoss) return 1;
  } catch { }
  try {
    // On TP (take profit)
    // If red bar
    if (stockData[tradeIndex].low < stockData[tradeIndex - 1].low)
      if (stockData[tradeIndex - 1].low > stockData[tradeIndex - 2].low)
        return 2;
  } catch { }
  return 0;
}

// We buy
function makeEntry() {
  // No table record: we account buyPrice at selling time
  // We do not want to remain with an open entry
  stopLoss = stockData[tradeIndex - 1].low;
  buyPrice = stockData[tradeIndex].open;
  buyDate = stockData[tradeIndex].date;
  amount = soldFinal * 0.05 / buyPrice;
}

// We stop loss
function makeExit1() {
  // Register entry point
  let debit = buyPrice * amount;
  let credit = 0;
  let soldInit = soldFinal;
  soldFinal += credit - debit;
  const buyRow = {
    date: buyDate,
    soldInit: soldInit.toFixed(2),
    sell: credit.toFixed(2),
    buy: debit.toFixed(2),
    soldFinal: soldFinal.toFixed(2)
  };
  table.push(buyRow);

  // Register exit point
  credit = stopLoss * amount;
  debit = 0;
  soldInit = soldFinal;
  soldFinal += credit - debit;
  const sellRow = {
    date: stockData[tradeIndex].date,
    soldInit: soldInit.toFixed(2),
    sell: credit.toFixed(2),
    buy: debit.toFixed(2),
    soldFinal: soldFinal.toFixed(2)
  };
  table.push(sellRow);
}

// We take profit
function makeExit2() {
  // Register entry point
  let credit = 0;
  let debit = buyPrice * amount;
  let soldInit = soldFinal;
  soldFinal += credit - debit;
  const buyRow = {
    date: buyDate,
    soldInit: soldInit.toFixed(2),
    sell: credit.toFixed(2),
    buy: debit.toFixed(2),
    soldFinal: soldFinal.toFixed(2)
  };
  table.push(buyRow);

  // Register exit point
  credit = stockData[tradeIndex].close * amount;
  debit = 0;
  soldInit = soldFinal;
  soldFinal += credit - debit;
  const sellRow = {
    date: stockData[tradeIndex].date,
    soldInit: soldInit.toFixed(2),
    sell: credit.toFixed(2),
    buy: debit.toFixed(2),
    soldFinal: soldFinal.toFixed(2)
  };
  table.push(sellRow);
}

// It is time to buy
function tryEntry() {
  if (condEntry()) {
    makeEntry();
    expectEntry = false;
  }
}

// It is time to sell
function tryExit() {
  let exitP = condExit();
  if (exitP == 1) {
    makeExit1();
    expectEntry = true;
  } else if (exitP == 2) {
    makeExit2();
    expectEntry = true;
  }
}

// Apply our strategy system
function getTable() {
  soldFinal = 10000.0;
  expectEntry = true;
  table = [];
  for (tradeIndex = 0; tradeIndex < stockData.length; tradeIndex++) {
    if (expectEntry) tryEntry();
    else tryExit();
  }
  return JSON.stringify(table);
}

// Remaining old code

function getStockData(jsonString) {
  return JSON.parse(jsonString);
}

function renderChart() {
  //stockData = getStockData();
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#aaaa55";
  context.fillRect(0, 0, canvas.width, canvas.height);
  for (let dataIndex = 0; dataIndex < stockData.length; dataIndex++) {
    drawCandlestick(dataIndex);
  }
  const jsonTable = getTable();
  const tableElement = createTable(jsonTable);
  const strategyElement = document.getElementById("Strategy");
  removeAllChildren(strategyElement);
  strategyElement.appendChild(tableElement);
}

function removeAllChildren(element) {
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
}

function drawCandlestick(dataIndex) {
  // default candlestick color
  let strokeStyle = "blue";

  // if two ascending days
  try {
    if (stockData[dataIndex].low > stockData[dataIndex - 1].low)
      if (
        stockData[dataIndex - 1].low > stockData[dataIndex - 2].low ||
        stockData[dataIndex + 1].low > stockData[dataIndex].low
      )
        strokeStyle = "green";
  } catch { }

  // if first descending day
  try {
    if (stockData[dataIndex - 2].low > stockData[dataIndex - 3].low)
      if (stockData[dataIndex - 1].low > stockData[dataIndex - 2].low)
        if (stockData[dataIndex - 1].low > stockData[dataIndex].low)
          strokeStyle = "red";
  } catch { }

  // Draw vertical line
  const scaleFactor = canvas.width / stockData.length;
  context.strokeStyle = strokeStyle;
  context.beginPath();
  context.moveTo(
    (dataIndex + 0.5) * scaleFactor,
    getY(stockData[dataIndex].low)
  );
  context.lineTo(
    (dataIndex + 0.5) * scaleFactor,
    getY(stockData[dataIndex].high)
  );
  context.stroke();

  // Fill bar
  switch (strokeStyle) {
    case "red":
      fillStyle = "#ff5555cc";
      break;
    case "green":
      fillStyle = "#55ff55cc";
      break;
    case "blue":
      fillStyle = "#5555ffcc";
      break;
  }
  context.strokeStyle = fillStyle;
  context.fillStyle = fillStyle;
  context.beginPath();
  const xPadding = 1.0 / 12.0;
  const fullBar = 10.0 / 12.0;
  context.fillRect(
    (dataIndex + xPadding) * scaleFactor,
    getY(stockData[dataIndex].open),
    fullBar * scaleFactor,
    getY(stockData[dataIndex].close) - getY(stockData[dataIndex].open)
  );
  context.stroke();

  // text N="number of green bars"
  if (strokeStyle === "red") {
    let auxDataIndex = dataIndex - 1;
    let countDataIndices = 0;
    while (auxDataIndex > 0) {
      if (stockData[auxDataIndex].low > stockData[auxDataIndex - 1].low) {
        countDataIndices++;
        auxDataIndex--;
      } else break;
    }
    const minChainIndices = 3;
    const yTextBottom = 8;
    if (auxDataIndex > 0 && countDataIndices >= minChainIndices) {
      context.fillStyle = "darkgreen";
      context.fillText(
        "N=" + countDataIndices,
        (dataIndex - 2) * scaleFactor,
        canvas.height - yTextBottom
      );
    }
  }

  // text beginning month, year
  const dayOfMonth = new Date(stockData[dataIndex].date).getDate();
  const calendas = 3;
  const yTextTop = 9;
  if (dayOfMonth <= calendas) {
    context.fillStyle = "blue";
    const monthIndex = new Date(stockData[dataIndex].date).getMonth();
    const fullYear = new Date(stockData[dataIndex].date).getFullYear();
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sept",
      "Oct",
      "Nov",
      "Dec"
    ];
    const month = months[monthIndex];
    context.fillText(
      month + " " + fullYear,
      (dataIndex + calendas - 1 - dayOfMonth) * scaleFactor,
      yTextTop
    );
  }
}

function getY(price) {
  let max = 0;
  let min = Infinity;
  for (const day of stockData) {
    if (day.low < min) min = day.low;
    if (day.high > max) max = day.high;
  }
  return canvas.height - ((price - min) / (max - min)) * canvas.height;
}

canvas.addEventListener("click", (event) => {
  event.preventDefault();
  const canvas = document.getElementById("chart");
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const i = Math.floor((x * stockData.length) / canvas.width);
  const date = new Date(stockData[i].date).toLocaleDateString();
  const open = stockData[i].open;
  const high = stockData[i].high;
  const low = stockData[i].low;
  const close = stockData[i].close;
  const color0 = "black";
  renderChart();
  context.strokeStyle = color0;
  context.beginPath();
  const canvasWidth = canvas.width;
  context.moveTo(0, getY(high));
  context.lineTo(canvasWidth - 1, getY(high));
  context.moveTo(0, getY(low));
  context.lineTo(canvasWidth - 1, getY(low));
  context.stroke();
  context.strokeStyle = color0;
  context.fillStyle = color0;
  context.beginPath();
  context.fillText(
    `date: ${date} h: ${high}`,
    canvasWidth - canvasWidth / 9,
    getY(high)
  );
  context.fillText(`l: ${low}`, canvasWidth - canvasWidth / 9, getY(low));
  context.stroke();
});

function downloadJSON() {
  document.getElementById("loading-indicator").classList.remove("hidden");
  const symbol = document.getElementById("stockTicker").value;
  const apiTokenMetered = "666d75fac3cab1.49750115";
  const checked = document.getElementById("useMeteredApiToken").checked;
  let apiToken = "demo";
  if (checked)
    apiToken = apiTokenMetered;
  const currDate = new Date();
  const currYear = currDate.getFullYear() - 1;
  const currMonth = currDate.getMonth() + 1;
  const currDayOfMonth = currDate.getDate();
  const url = `https://eodhd.com/api/eod/${symbol}?api_token=${apiToken}&fmt=json&from=${currYear}-${currMonth}-${currDayOfMonth}`;
  fetch(url)
    .then((response) => {
      return response.text();
    })
    .then((data) => {
      stockData = JSON.parse(data);
      const stockElement = createTable(data);
      const dataElement = document.getElementById("Data");
      removeAllChildren(dataElement);
      dataElement.appendChild(stockElement);
      document.getElementById("loading-indicator").classList.add("hidden");
      renderChart();
    })
    .catch((error) => {
      console.error(error);
      document.getElementById("loading-indicator").classList.add("hidden");
      alert("Cannot fetch this with token `demo'." + error + "Consider using metered token or another ticker");
    });
}
