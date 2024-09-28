// Constants
const MAKES = ['Audi', 'BMW', 'Chevrolet', 'Daihatsu', 'Ford', 'Honda', 'Hyundai', 
    'Isuzu', 'Jaguar', 'Jeep', 'Kia', 'Landrover', 'Lexus', 'Mahindra', 
    'Mazda', 'Mercedes Benz', 'Mini', 'Mitsubishi', 'Nissan', 'Peugeot', 
    'Porsche', 'Range Rover', 'Renault', 'Subaru', 'Suzuki', 'Tata', 
    'Toyota', 'Volkswagen', 'Volvo'];

const MODELS = {
    'Audi': ['A3', 'A4', 'A5', 'A6', 'Q3', 'Q5', 'Q7'],
    'BMW': ['1 series', '3 series', '5 series', 'x1', 'x3', 'x4', 'x5', 'x6'],
    'Chevrolet': ['Cruze', 'TrailBlazer'],
    'Daihatsu': ['Mira', 'Terios'],
    'Ford': ['Escape', 'Everest', 'Kuga', 'Ranger'],
    'Honda': ['Airwave', 'Civic', 'CR-v', 'fit jazz', 'Fit Shuttle', 'INSIGHT', 'stepwgn', 'stream', 'vezel'],
    // Add the rest of the models here
};

const API_CONFIG = {
    BASE_URL: 'https://public.opendatasoft.com/api/explore/v2.1/catalog/datasets/all-vehicles-model/records',
    BATCH_SIZE: 100,
    CONCURRENT_REQUESTS: 5,
    MAX_RETRIES: 3,
    RETRY_DELAY: 1000,
};

const EMAIL_CONFIG = {
    SERVICE_ID: 'service_2pmrqw8',
    TEMPLATE_ID: 'template_c041qjl',
    RECIPIENT_EMAIL: 'bransonallan@gmail.com',
};

// UI Elements
const UI = {
    makeSelect: document.getElementById('makeSelect'),
    modelSelect: document.getElementById('modelSelect'),
    emailButton: document.getElementById('emailButton'),
    downloadButton: document.getElementById('downloadButton'),
    progressSection: document.getElementById('progressSection'),
    progressBar: document.getElementById('progressBar'),
    progressFill: document.getElementById('progressFill'),
    progressText: document.getElementById('progressText'),
    totalRecordsElement: document.getElementById('totalRecords'),
    resultSection: document.getElementById('resultSection'),
    resultTitle: document.getElementById('resultTitle'),
    resultMessage: document.getElementById('resultMessage'),
    loadingSpinner: document.getElementById('loadingSpinner'),
};

// Initialize the application
function initApp() {
    populateMakeDropdown();
    attachEventListeners();
    emailjs.init('EevX8WfcudHu9GwPh');
}

// Populate make dropdown
function populateMakeDropdown() {
    MAKES.forEach(make => {
        const option = document.createElement('option');
        option.value = make;
        option.textContent = make;
        UI.makeSelect.appendChild(option);
    });
}

// Attach event listeners
function attachEventListeners() {
    UI.makeSelect.addEventListener('change', handleMakeChange);
    UI.modelSelect.addEventListener('change', handleModelChange);
    UI.emailButton.addEventListener('click', () => exportData('email'));
    UI.downloadButton.addEventListener('click', () => exportData('download'));
}

// Handle make change
function handleMakeChange() {
    const selectedMake = UI.makeSelect.value;
    resetModelDropdown();

    if (selectedMake) {
        const models = MODELS[selectedMake];
        if (!models || models.length === 0) {
            showError('No models available for this make.');
            return;
        }
        populateModelDropdown(models);
        UI.modelSelect.disabled = false;
    } else {
        UI.modelSelect.disabled = true;
    }

    updateExportButtons();
}

// Reset model dropdown
function resetModelDropdown() {
    UI.modelSelect.innerHTML = '<option value="">-- Select Model --</option>';
}

// Populate model dropdown
function populateModelDropdown(models) {
    models.forEach(model => {
        const option = document.createElement('option');
        option.value = model;
        option.textContent = model;
        UI.modelSelect.appendChild(option);
    });
}

// Handle model change
function handleModelChange() {
    updateExportButtons();
}

// Update export buttons state
function updateExportButtons() {
    const isModelSelected = UI.modelSelect.value !== '';
    UI.emailButton.disabled = !isModelSelected;
    UI.downloadButton.disabled = !isModelSelected;
}

// Utility functions
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const escapeCSV = (str) => {
    if (str == null) return '';
    return `"${str.replace(/"/g, '""')}"`;
};

// Update progress UI
function updateProgress(progress, recordCount) {
    UI.progressFill.style.width = `${progress}%`;
    UI.progressBar.setAttribute('aria-valuenow', progress);
    UI.progressText.textContent = `${Math.round(progress)}% Complete`;
    UI.totalRecordsElement.textContent = `Total Records: ${recordCount}`;
}

// Show result message
function showResult(success, message) {
    UI.resultSection.classList.remove('hidden', 'success', 'error');
    UI.resultSection.classList.add(success ? 'success' : 'error');
    UI.resultTitle.textContent = success ? 'Export Successful' : 'Export Failed';
    UI.resultMessage.textContent = message;
}

// Show error message
function showError(message) {
    showResult(false, message);
}

// API interaction
async function fetchData(make, model, offset = 0) {
    const url = `${API_CONFIG.BASE_URL}?where=make="${encodeURIComponent(make)}" AND model="${encodeURIComponent(model)}"&rows=${API_CONFIG.BATCH_SIZE}&start=${offset}`;
    
    for (let attempt = 0; attempt < API_CONFIG.MAX_RETRIES; attempt++) {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error(`Attempt ${attempt + 1} failed for ${make} at offset ${offset}: ${error.message}`);
            if (attempt === API_CONFIG.MAX_RETRIES - 1) throw error;
            await delay(API_CONFIG.RETRY_DELAY * (attempt + 1)); // Exponential backoff
        }
    }
}

async function fetchAllDataForMakeAndModel(make, model) {
    let allResults = [];
    let offset = 0;
    let hasMoreResults = true;

    while (hasMoreResults) {
        const data = await fetchData(make, model, offset);
        if (!data || !data.results) {
            console.error(`No results found for ${make} ${model} at offset ${offset}`);
            break;
        }
        allResults = allResults.concat(data.results);
        offset += data.results.length;
        hasMoreResults = data.results.length === API_CONFIG.BATCH_SIZE;

        const progress = (offset / (offset + data.results.length)) * 100;
        updateProgress(progress, allResults.length);
    }

    return allResults;
}

// CSV generation and export functions
function generateCSV(data) {
    let csv = "Make,Model,Year\n"; // Add headers

    data.forEach(record => {
        const make = escapeCSV(record.fields.make);
        const model = escapeCSV(record.fields.model);
        const year = escapeCSV(record.fields.year);
        csv += `${make},${model},${year}\n`;
    });

    return csv;
}

// Download CSV file
function downloadCSV(csvContent, fileName) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', fileName);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

// Send CSV via email using EmailJS
async function sendEmail(csvContent) {
    const emailParams = {
        to_email: EMAIL_CONFIG.RECIPIENT_EMAIL,
        subject: 'Vehicle Data Export',
        message: 'Please find the attached CSV file with vehicle data.',
        csv_data: csvContent
    };

    try {
        await emailjs.send(EMAIL_CONFIG.SERVICE_ID, EMAIL_CONFIG.TEMPLATE_ID, emailParams);
        console.log('Email sent successfully');
    } catch (error) {
        console.error('Failed to send email:', error);
        throw new Error('Failed to send email');
    }
}

// Export data based on selected type (email or download)
async function exportData(exportType) {
    const make = UI.makeSelect.value;
    const model = UI.modelSelect.value;

    if (!make || !model) {
        showError('Please select both make and model.');
        return;
    }

    setUIState('exporting');
    
    try {
        const allData = await fetchAllDataForMakeAndModel(make, model);
        console.log(`Total records fetched: ${allData.length}`);

        if (allData.length === 0) {
            throw new Error('No data found for the selected make and model.');
        }

        const csvContent = generateCSV(allData);
        
        if (exportType === 'email') {
            await sendEmail(csvContent);
            showResult(true, `Export successful. ${allData.length} records sent to ${EMAIL_CONFIG.RECIPIENT_EMAIL}`);
        } else if (exportType === 'download') {
            downloadCSV(csvContent, `${make}_${model}_vehicle_data.csv`);
            showResult(true, `Export successful. ${allData.length} records downloaded.`);
        }
    } catch (error) {
        console.error(`Error exporting data: ${error.message}`);
        showError(`Export failed: ${error.message}`);
    } finally {
        setUIState('idle');
    }
}

// Set UI state
function setUIState(state) {
    switch (state) {
        case 'exporting':
            UI.emailButton.disabled = true;
            UI.downloadButton.disabled = true;
            UI.progressSection.classList.remove('hidden');
            UI.loadingSpinner.classList.remove('hidden');
            UI.resultSection.classList.add('hidden');
            break;
        case 'idle':
            UI.emailButton.disabled = false;
            UI.downloadButton.disabled = false;
            UI.progressSection.classList.add('hidden');
            UI.loadingSpinner.classList.add('hidden');
            break;
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', initApp);