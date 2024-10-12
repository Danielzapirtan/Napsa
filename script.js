const canvas = document.getElementById("chart");
const context = canvas.getContext("2d");
const log = document.getElementById("log");
let stockData;
const useMockData = false;

const shorts = 12;
const longs = 26;
let positionSize;
let entryDate;
let entryPrice;
let isEntryExpected;
let remainingCapital;
let table;
let currentIndex;
log.innerHTML = ``;
const tabs = document.querySelectorAll(".tab");
const tabContent = document.querySelectorAll(".tab-pane");
showTab(0);
document.getElementById("useMeteredApiToken").checked = false;
downloadJSON();

function devlog(message) {
  log.innerHTML = message;
}

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

tabs.forEach((tab, index) => {
  tab.addEventListener("click", () => {
    showTab(index);
  });
});

// TODO Increase readability

function ma(dayCount, yest) {
	let sum = 0;
	for (let count = 0; count < dayCount; count++)
		try {
		sum += stockData[currentIndex - count - yest].close;
		} catch { }
	return sum / dayCount;
}

// Whether we may buy
function condEntry() {
  try {
	  let shortMA = ma(shorts, 1);
	  let longMA = ma(longs, 1);
	  if (shortMA > longMA)
		  return 0;
	  shortMA = ma(shorts, 0);
	  longMA = ma(longs, 0);
	  if (shortMA > longMA)
		  return 1;
  } catch { }
  return 0;
}

// Whether we may sell
function condExit() {
  try {
	  let shortMA = ma(shorts, 1);
	  let longMA = ma(longs, 1);
	  if (shortMA < longMA)
		  return 0;
	  shortMA = ma(shorts, 0);
	  longMA = ma(longs, 0);
	  if (shortMA < longMA)
		  return 1;
  } catch { }
  return 0;
}

// We buy
function makeEntry() {
  // No table record: we account entryPrice at selling time
  // We do not want to remain with an open entry
  entryPrice = stockData[currentIndex].open;
  entryDate = stockData[currentIndex].date;
  positionSize = remainingCapital * 0.05 / entryPrice;
}

// We sell
function makeExit() {
  // Register entry point
  let debit = entryPrice * positionSize;
  let credit = 0;
  let soldInit = remainingCapital;
  remainingCapital += credit - debit;
  const buyRow = {
    date: entryDate,
    capital: soldInit.toFixed(2),
    entry: debit.toFixed(2),
    exit: credit.toFixed(2),
    remainingCapital: remainingCapital.toFixed(2)
  };
  table.push(buyRow);

  // Register exit point
  credit = stockData[currentIndex].close * positionSize;
  debit = 0;
  soldInit = remainingCapital;
  remainingCapital += credit - debit;
  const sellRow = {
    date: stockData[currentIndex].date,
    capital: soldInit.toFixed(2),
    entry: debit.toFixed(2),
    exit: credit.toFixed(2),
    remainingCapital: remainingCapital.toFixed(2)
  };
  table.push(sellRow);
}

// It is time to buy
function tryEntry() {
  if (condEntry()) {
    makeEntry();
    isEntryExpected = false;
  }
}

// It is time to sell
function tryExit() {
  const exitP = condExit();
  if (exitP == 1) {
    makeExit();
    isEntryExpected = true;
  }
}

// Apply our strategy system
function getTable() {
  remainingCapital = 10000.0;
  isEntryExpected = true;
  table = [];
  for (currentIndex = 0; currentIndex < stockData.length; currentIndex++) {
    if (isEntryExpected) tryEntry();
    else tryExit();
  }
  return JSON.stringify(table);
}

function getStockData(jsonString) {
  return JSON.parse(jsonString);
}

function renderChart() {
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

const selectElement = document.getElementById("stock-picker");

let timeout;

selectElement.addEventListener('change', () => {
  clearTimeout(timeout);
  timeout = setTimeout(() => {
	  downloadJSON();
  }, 300);
});

function downloadJSON() {
  // Show loading indicator
  document.getElementById("loading-indicator").style.display = "block"; // for older browsers without classList

  const symbol = document.getElementById("stock-picker").value;
  const apiTokenMetered = "666d75fac3cab1.49750115";
  const checked = document.getElementById("useMeteredApiToken").checked;
  let apiToken = "demo";
  if (checked) {
    apiToken = apiTokenMetered;
  }
  const currDate = new Date();
  const currYear = currDate.getFullYear() - 1;
  const currMonth = currDate.getMonth() + 1;
  const currDayOfMonth = currDate.getDate();
  const date = `${currYear}-${currMonth}-${currDayOfMonth}`;
  const url = `https://eodhd.com/api/eod/${symbol}?api_token=${apiToken}&fmt=json&from=${date}`;

  // XMLHttpRequest for older browsers (fallback)
  //if (!window.fetch) {
  if (false) {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", url);
    xhr.onload = function () {
      if (xhr.status === 200) {
        const data = xhr.responseText;
        stockData = JSON.parse(data);
        const stockElement = createTable(data);
        const dataElement = document.getElementById("Data");
        removeAllChildren(dataElement);
        dataElement.appendChild(stockElement);
        document.getElementById("loading-indicator").style.display = "none";
        renderChart();
      } else {
        console.error("Error:", xhr.statusText);
        document.getElementById("loading-indicator").style.display = "none";
        devlog("Unsupported browser");
      }
    };
    xhr.onerror = function () {
      console.error("Network Error");
      document.getElementById("loading-indicator").style.display = "none";
      devlog("Unsupported browser");
    };
    xhr.send();
  } else {
    // Use fetch for modern browsers
    fetch(url)
      .then((response) => {
        return response.text();
      })
      .then((data) => {
        stockData = JSON.parse(data);
        const stockElement = createTable(JSON.stringify(stockData));
        const dataElement = document.getElementById("Data");
        removeAllChildren(dataElement);
        dataElement.appendChild(stockElement);
        document.getElementById("loading-indicator").style.display = "none";
        renderChart();
      })
      .catch((error) => {
        console.error(error);
        document.getElementById("loading-indicator").style.display = "none";
        alert("Load failed!");
      });
  }
};

function getMockData() {
    const mockData = [];
    const startDate = new Date();
    const days = 366; // number of days to generate data for
    let price = 100; // starting price

    for (let i = 0; i < days; i++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() - i);

        // Randomly vary the stock price
        price += (Math.random() - 0.5) * 2; // Adjust the variance as needed
        const high = price + Math.random() * 5;
        const low = price - Math.random() * 5;
        const open = price + Math.random() * 2;
        const close = price - Math.random() * 2;
        
        mockData.push({
            date: date.toISOString().split('T')[0],
            open: open.toFixed(2),
            high: high.toFixed(2),
            low: low.toFixed(2),
            close: close.toFixed(2),
            volume: Math.floor(Math.random() * 1000 + 100)
        });
    }

    return mockData;
}
