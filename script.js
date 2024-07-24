document.addEventListener('DOMContentLoaded', () => {
    // Existing functionality
    const calculateButton = document.getElementById('calculate');
    calculateButton.addEventListener('click', handleCalculation);

    const fileInput = document.getElementById('csvFile');
    fileInput.addEventListener('change', handleFileUpload);

    const refreshButton = document.getElementById('refresh');
    refreshButton.addEventListener('click', refreshCalculator);

    document.getElementById('currentYear').textContent = new Date().getFullYear();

    // New tab switching functionality
    const tabLinks = document.querySelectorAll('.sidebar nav ul li a');
    const tabContents = document.querySelectorAll('.tab-content');

    tabLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();

            // Remove active class from all links and contents
            tabLinks.forEach(l => l.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            // Add active class to clicked link and corresponding content
            this.classList.add('active');
            const contentId = this.getAttribute('href').substring(1);
            document.getElementById(contentId).classList.add('active');
        });
    });
});

function handleCalculation() {
    const fileInput = document.getElementById('csvFile');
    if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        const reader = new FileReader();
        reader.onload = function(e) {
            const contents = e.target.result;
            processCSV(contents);
        };
        reader.readAsText(file);
    } else {
        const seroprotection = parseFloat(document.getElementById('seroprotection').value);
        const lastVaccinationDate = new Date(document.getElementById('lastVaccinationDate').value);
        const result = calculateRisk(seroprotection, lastVaccinationDate);
        if (result) {
            displayResults([result]);
        }
    }
}

function calculateMonthsSinceVaccination(fromDate, toDate) {
    const yearDiff = toDate.getFullYear() - fromDate.getFullYear();
    const monthDiff = toDate.getMonth() - fromDate.getMonth();
    
    // Calculate the base number of months
    let months = yearDiff * 12 + monthDiff;
    
    // Calculate the day difference
    const fromDayOfMonth = fromDate.getDate();
    const toDayOfMonth = toDate.getDate();
    const daysInFromMonth = new Date(fromDate.getFullYear(), fromDate.getMonth() + 1, 0).getDate();
    
    // Calculate the fractional month
    let fractionalMonth;
    if (toDayOfMonth >= fromDayOfMonth) {
        fractionalMonth = (toDayOfMonth - fromDayOfMonth) / daysInFromMonth;
    } else {
        months -= 1;
        const daysInPreviousMonth = new Date(toDate.getFullYear(), toDate.getMonth(), 0).getDate();
        fractionalMonth = (daysInPreviousMonth - fromDayOfMonth + toDayOfMonth) / daysInPreviousMonth;
    }
    
    // Add the fractional month to the total
    months += fractionalMonth;
    
    return months;
}

function calculateRisk(seroprotection, lastVaccinationDate, regionId = null) {
    const errorMessages = document.getElementById('errorMessages');
    errorMessages.innerHTML = '';

    if (isNaN(seroprotection) || seroprotection < 0 || seroprotection > 100) {
        errorMessages.innerHTML += '<p>Seroprotection value should be between 0 and 100.</p>';
        return null;
    }

    if (isNaN(lastVaccinationDate.getTime())) {
        errorMessages.innerHTML += '<p>Please enter a valid date in YYYY-MM-DD format.</p>';
        return null;
    }

    const currentDate = new Date();
    if (lastVaccinationDate > currentDate) {
        errorMessages.innerHTML += '<p>Last vaccination date cannot be ahead of current date.</p>';
        return null;
    }

    const monthsSinceVaccination = calculateMonthsSinceVaccination(lastVaccinationDate, currentDate);
    const currentProtection = sigmoid(monthsSinceVaccination, seroprotection);

    const riskLevel = getRiskLevel(currentProtection);
    const nextVaccinationDate = getNextVaccinationDate(seroprotection, lastVaccinationDate);

    return {
        regionId,
        initialSeroprotection: seroprotection,
        currentProtection,
        riskLevel,
        nextVaccinationDate,
        lastVaccinationDate
    };
}

function sigmoid(t, P, k = 0.85, x0 = 6) {
    epsilon = 10e-9
    return P / (1 + (t/(t+epsilon)) * Math.exp(k * (t - x0)));
}

function getRiskLevel(protection) {
    if (protection > 53) return { level: 'Low', color: 'green' };
    if (protection > 46) return { level: 'Medium', color: 'yellow' };
    if (protection > 39) return { level: 'High', color: 'orange' };
    return { level: 'Very High', color: 'red' };
}

function getNextVaccinationDate(initialProtection, lastVaccinationDate) {
    if (initialProtection <= 46) {
        const currentDate = new Date();
        return `${currentDate.toLocaleString('default', { month: 'short' })} ${currentDate.getFullYear()}`;
    }

    let months = 0;
    while (sigmoid(months, initialProtection) > 46 && months < 12) {
        months++;
    }

    const nextVaccinationDate = new Date(lastVaccinationDate);
    nextVaccinationDate.setMonth(nextVaccinationDate.getMonth() + months - 1);

    const currentDate = new Date();
    if (currentDate > nextVaccinationDate) {
        return `${currentDate.toLocaleString('default', { month: 'short' })} ${currentDate.getFullYear()}`;
    }

    return `${nextVaccinationDate.toLocaleString('default', { month: 'short' })} ${nextVaccinationDate.getFullYear()}`;
}



function handleFileUpload(event) {
    const file = event.target.files[0];
    if (file) {
        document.getElementById('fileName').textContent = file.name;
    }
}

function processCSV(contents) {
    const lines = contents.split('\n');
    const headers = lines[0].split(',');
    const data = [];
    const errorMessages = document.getElementById('errorMessages');
    errorMessages.innerHTML = '';

    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',');
        if (values.length === headers.length) {
            const entry = {};
            headers.forEach((header, index) => {
                entry[header.trim()] = values[index].trim();
            });
            
            const seroprotection = parseFloat(entry.seroprotection_value);
            const lastVaccinationDate = new Date(entry.last_vaccinated_date);
            
            const result = calculateRisk(seroprotection, lastVaccinationDate, entry.region_id);
            if (result) {
                data.push(result);
            }
        }
    }

    displayResults(data);
}

function displayResults(data) {
    const resultsContainer = document.getElementById('results');
    resultsContainer.innerHTML = '';

    data.forEach(result => {
        const risk = getRiskLevel(result.currentProtection);
        
        const resultItem = document.createElement('div');
        resultItem.className = 'result-item';
        resultItem.innerHTML = `
            <h3>${result.regionId ? `Region ${result.regionId}` : 'Summary'}</h3>
            <p>Initial Seroprotection: ${result.initialSeroprotection.toFixed(2)}%</p>
            <p>Current Protection: ${result.currentProtection.toFixed(2)}%</p>
            <p>Last Vaccination Date: ${new Date(result.lastVaccinationDate).toDateString()}</p>
            <p>Risk Level: <span class="risk-level" data-level="${risk.level}" style="background-color: ${risk.color}; color: ${risk.level === 'Medium' ? 'black' : 'white'}">${risk.level}</span></p>
            <p>Next Vaccination due: ${result.nextVaccinationDate !== 'Last vaccination did not achieve herd immunity.' ? formatDate(result.nextVaccinationDate) : result.nextVaccinationDate}</p>
        `;
        resultsContainer.appendChild(resultItem);

        const timelineContainer = document.createElement('div');
        timelineContainer.id = `timeline-${result.regionId || 'summary'}`;
        timelineContainer.className = 'timeline-container';
        resultsContainer.appendChild(timelineContainer);

        updateRiskTimeline(result.initialSeroprotection, new Date(result.lastVaccinationDate), timelineContainer);
    });
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return `${date.toLocaleString('default', { month: 'short' })} ${date.getFullYear()}`;
}

function updateRiskTimeline(initialProtection, lastVaccinationDate, timelineContainer) {
    const canvas = document.createElement('canvas');
    timelineContainer.innerHTML = '';
    timelineContainer.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    const months = [];
    const protectionLevels = [];
    const backgroundColors = [];

    // Generate 12 months of data from the last vaccination date
    for (let i = 0; i < 12; i++) {
        const labelDate = new Date(lastVaccinationDate);
        labelDate.setMonth(lastVaccinationDate.getMonth() + i + 1); // Set to next month
        labelDate.setDate(0); // Set to the last day of the previous month
        
        months.push(formatDate(labelDate));

        const monthsSinceVaccination = calculateMonthsSinceVaccination(lastVaccinationDate, labelDate);
        const currentProtection = sigmoid(monthsSinceVaccination, initialProtection);

        protectionLevels.push(currentProtection);
        backgroundColors.push(getRiskLevel(currentProtection).color);
    }

    // Plot the chart
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: months,
            datasets: [{
                label: 'Protection Level',
                data: protectionLevels,
                backgroundColor: backgroundColors,
                borderColor: 'rgba(0, 0, 0, 0.1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    title: {
                        display: true,
                        text: 'Protection Level'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Month and Year'
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
}

function refreshCalculator() {
    document.getElementById('seroprotection').value = '';
    document.getElementById('lastVaccinationDate').value = '';
    document.getElementById('csvFile').value = '';
    document.getElementById('fileName').textContent = '';
    document.getElementById('errorMessages').innerHTML = '';
    document.getElementById('results').innerHTML = '';
    if (window.riskChart) {
        window.riskChart.destroy();
    }
}