// Constants
const MAKES = ['Audi', 'BMW', 'Chevrolet', 'Daihatsu', 'Ford', 'Honda', 'Hyundai', 
    'Isuzu', 'Jaguar', 'Jeep', 'Kia', 'Landrover', 'Lexus', 'Mahindra', 
    'Mazda', 'Mercedes Benz', 'Mini', 'Mitsubishi', 'Nissan', 'Peugeot', 
    'Porsche', 'Range Rover', 'Renault', 'Subaru', 'Suzuki', 'Tata', 
    'Toyota', 'Volkswagen', 'Volvo'];
const API_BASE_URL = 'https://public.opendatasoft.com/api/explore/v2.1/catalog/datasets/all-vehicles-model/records';
const BATCH_SIZE = 100;
const CONCURRENT_REQUESTS = 5;
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

// EmailJS configuration
const EMAIL_SERVICE_ID = 'service_2pmrqw8';
const EMAIL_TEMPLATE_ID = 'template_3rc1zwq';
const RECIPIENT_EMAIL = 'bransonallan@gmail.com';

// UI Elements
const exportButton = document.getElementById('exportButton');
const progressContainer = document.getElementById('progressContainer');
const progressBar = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const totalRecordsElement = document.getElementById('totalRecords');
const resultContainer = document.getElementById('resultContainer');
const resultTitle = document.getElementById('resultTitle');
const resultMessage = document.getElementById('resultMessage');

// Utility functions
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const escapeCSV = (str) => {
    if (str == null) return '';
    return `"${str.replace(/"/g, '""')}"`;
};

const updateProgress = (progress, recordCount) => {
    progressBar.style.width = `${progress}%`;
    progressText.textContent = `${Math.round(progress)}% Complete`;
    totalRecordsElement.textContent = `Total Records: ${recordCount}`;
};

const showResult = (success, message) => {
    resultContainer.classList.remove('hidden');
    resultContainer.className = success ? 'success' : 'error';
    resultTitle.textContent = success ? 'Export Successful' : 'Export Failed';
    resultMessage.textContent = message;
};

// API interaction
async function fetchData(make, offset = 0) {
    const url = `${API_BASE_URL}?where=make="${encodeURIComponent(make)}"&rows=${BATCH_SIZE}&start=${offset}`;
    
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error(`Attempt ${attempt + 1} failed for ${make} at offset ${offset}: ${error.message}`);
            if (attempt === MAX_RETRIES - 1) throw error;
            await delay(RETRY_DELAY * (attempt + 1)); // Exponential backoff
        }
    }
}

async function fetchAllDataForMake(make) {
    let allResults = [];
    let offset = 0;
    let hasMoreResults = true;

    while (hasMoreResults) {
        const data = await fetchData(make, offset);
        if (!data || !data.results) {
            console.error(`No results found for ${make} at offset ${offset}`);
            break;
        }
        allResults = allResults.concat(data.results);
        offset += data.results.length;
        hasMoreResults = data.results.length === BATCH_SIZE;
    }

    return allResults;
}

async function fetchAllData() {
    let allData = [];
    let completedMakes = 0;
    const updateInterval = setInterval(() => {
        const progress = (completedMakes / MAKES.length) * 100;
        updateProgress(progress, allData.length);
    }, 100);

    const makeChunks = [];
    for (let i = 0; i < MAKES.length; i += CONCURRENT_REQUESTS) {
        makeChunks.push(MAKES.slice(i, i + CONCURRENT_REQUESTS));
    }

    for (const chunk of makeChunks) {
        const chunkResults = await Promise.all(chunk.map(async (make) => {
            const data = await fetchAllDataForMake(make);
            completedMakes++;
            return data;
        }));
        allData = allData.concat(chunkResults.flat());
    }

    clearInterval(updateInterval);
    updateProgress(100, allData.length);

    return allData;
}

// CSV generation
function generateCSV(data) {
    let csv = "Make,Model,Year\n";
    for (const vehicle of data) {
        csv += `${escapeCSV(vehicle.make)},${escapeCSV(vehicle.model)},${escapeCSV(vehicle.year)}\n`;
    }
    return csv;
}

// Email sending
async function sendEmail(csvContent) {
    const templateParams = {
        to_email: RECIPIENT_EMAIL,
        message: 'Please find the attached vehicle data.',
        csv: csvContent
    };

    try {
        const response = await emailjs.send(EMAIL_SERVICE_ID, EMAIL_TEMPLATE_ID, templateParams);
        console.log('Email sent successfully!', response.status, response.text);
        return response;
    } catch (error) {
        console.error('Error sending email:', error);
        throw error;
    }
}

// Main export function
async function exportCSV() {
    exportButton.disabled = true;
    progressContainer.classList.remove('hidden');
    resultContainer.classList.add('hidden');
    
    try {
        const allData = await fetchAllData();
        console.log(`Total records fetched: ${allData.length}`);

        const csvContent = generateCSV(allData);
        
        await sendEmail(csvContent);
        showResult(true, `Export successful. ${allData.length} records sent to ${RECIPIENT_EMAIL}`);
    } catch (error) {
        console.error('Error during export:', error);
        showResult(false, `Export failed: ${error.message}`);
    }

    exportButton.disabled = false;
}

// Set up event listener
exportButton.addEventListener('click', exportCSV);