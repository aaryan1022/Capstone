document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const runButton = document.getElementById('runSimulation');
    const resetButton = document.getElementById('resetSimulation');
    const statusDiv = document.getElementById('status');
    const progressBar = document.getElementById('progressBar');
    const resultsContainer = document.getElementById('resultsContainer');
    const presetSelector = document.getElementById('presetSelector');
    const aboutLink = document.getElementById('aboutLink');
    const aboutModal = document.getElementById('aboutModal');
    const closeButton = document.querySelector('.close-button');
    const downloadButton = document.getElementById('downloadResults');
    const fullscreenButton = document.getElementById('toggleFullscreen');
    
    // Form elements
    const humanPopulation = document.getElementById('humanPopulation');
    const humanPopulationSlider = document.getElementById('humanPopulationSlider');
    const mosquitoPopulation = document.getElementById('mosquitoPopulation');
    const mosquitoPopulationSlider = document.getElementById('mosquitoPopulationSlider');
    const numHouses = document.getElementById('numHouses');
    const numHousesSlider = document.getElementById('numHousesSlider');
    const temperature = document.getElementById('temperature');
    const temperatureSlider = document.getElementById('temperatureSlider');
    const numDays = document.getElementById('numDays');
    const numDaysSlider = document.getElementById('numDaysSlider');
    
    // Tab elements
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabPanes = document.querySelectorAll('.tab-pane');
    
    // Summary elements
    const peakInfection = document.getElementById('peakInfection');
    const peakDay = document.getElementById('peakDay');
    const totalInfected = document.getElementById('totalInfected');
    const infectionRate = document.getElementById('infectionRate');
    const mosquitoImpact = document.getElementById('mosquitoImpact');
    
    // Store simulation results
    let simulationResults = null;
    
    // Simulation presets
    const presets = {
        small: {
            humanPopulation: 1000,
            mosquitoPopulation: 2000,
            numHouses: 50,
            temperature: 20,
            numDays: 300
        },
        medium: {
            humanPopulation: 10000,
            mosquitoPopulation: 15000,
            numHouses: 200,
            temperature: 25,
            numDays: 500
        },
        large: {
            humanPopulation: 30000,
            mosquitoPopulation: 40000,
            numHouses: 500,
            temperature: 30,
            numDays: 700
        }
    };
    
    // Initialize UI
    initializeUI();
    
    // Event Listeners
    runButton.addEventListener('click', runSimulation);
    resetButton.addEventListener('click', resetSimulation);
    presetSelector.addEventListener('change', applyPreset);
    aboutLink.addEventListener('click', openAboutModal);
    closeButton.addEventListener('click', closeAboutModal);
    downloadButton.addEventListener('click', downloadResults);
    fullscreenButton.addEventListener('click', toggleFullscreen);
    
    // Sync sliders and number inputs
    setupInputSync(humanPopulation, humanPopulationSlider);
    setupInputSync(mosquitoPopulation, mosquitoPopulationSlider);
    setupInputSync(numHouses, numHousesSlider);
    setupInputSync(temperature, temperatureSlider);
    setupInputSync(numDays, numDaysSlider);
    
    // Tab switching
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.getAttribute('data-tab');
            switchTab(tabId);
        });
    });
    
    // Initialize UI elements
    function initializeUI() {
        // Hide results initially
        resultsContainer.style.display = 'none';
        
        // Set up window click for modal
        window.addEventListener('click', (e) => {
            if (e.target === aboutModal) {
                closeAboutModal();
            }
        });
    }
    
    // Sync number input with slider
    function setupInputSync(numberInput, slider) {
        // Update number when slider changes
        slider.addEventListener('input', () => {
            numberInput.value = slider.value;
        });
        
        // Update slider when number changes
        numberInput.addEventListener('input', () => {
            slider.value = numberInput.value;
        });
    }
    
    // Apply preset values
    function applyPreset() {
        const preset = presetSelector.value;
        
        if (preset !== 'custom' && presets[preset]) {
            const settings = presets[preset];
            
            humanPopulation.value = settings.humanPopulation;
            humanPopulationSlider.value = settings.humanPopulation;
            
            mosquitoPopulation.value = settings.mosquitoPopulation;
            mosquitoPopulationSlider.value = settings.mosquitoPopulation;
            
            numHouses.value = settings.numHouses;
            numHousesSlider.value = settings.numHouses;
            
            temperature.value = settings.temperature;
            temperatureSlider.value = settings.temperature;
            
            numDays.value = settings.numDays;
            numDaysSlider.value = settings.numDays;
        }
    }
    
    // Switch between tabs
    function switchTab(tabId) {
        // Update active tab button
        tabButtons.forEach(button => {
            if (button.getAttribute('data-tab') === tabId) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        });
        
        // Show active tab content
        tabPanes.forEach(pane => {
            if (pane.id === tabId) {
                pane.classList.add('active');
            } else {
                pane.classList.remove('active');
            }
        });
    }
    
    // Run the simulation
    function runSimulation() {
        // Validate inputs
        if (!validateInputs()) {
            statusDiv.textContent = 'Please fill in all fields with valid values';
            statusDiv.style.color = 'var(--danger-color)';
            return;
        }
        
        // Show loading state
        statusDiv.textContent = 'Running simulation...';
        statusDiv.style.color = 'var(--text-color)';
        progressBar.style.width = '0%';
        
        // Animate progress bar
        let progress = 0;
        const progressInterval = setInterval(() => {
            progress += 1;
            progressBar.style.width = `${Math.min(progress, 95)}%`;
            
            if (progress >= 95) {
                clearInterval(progressInterval);
            }
        }, 100);
        
        // Prepare data for API call
        const simulationData = {
            humanPopulation: parseInt(humanPopulation.value),
            mosquitoPopulation: parseInt(mosquitoPopulation.value),
            numHouses: parseInt(numHouses.value),
            temperature: parseFloat(temperature.value),
            numDays: parseInt(numDays.value)
        };
        
        // Make API call to run simulation
        fetch('/api/run-simulation', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(simulationData)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            // Hide loader
            progressBar.style.width = '100%';
            setTimeout(() => {
                progressBar.style.width = '0%';
            }, 500);
            statusDiv.textContent = 'Simulation completed successfully!';
            
            // Plot the results
            plotGlobalStats(data.globalStats);
            plotHouseInfected(data.houseStats);
        })
        .catch(error => {
            progressBar.style.width = '100%';
            setTimeout(() => {
                progressBar.style.width = '0%';
            }, 500);
            statusDiv.textContent = 'Error running simulation: ' + error.message;
            console.error('Error:', error);
        });
    }
    
    function plotGlobalStats(data) {
        // Parse the CSV data
        const lines = data.trim().split('\n');
        const headers = lines[0].split(',');
        
        const days = [];
        const S_list = [];
        const I_list = [];
        const R_list = [];
        const E_m_list = [];
        const I_m_list = [];
        
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',');
            days.push(parseInt(values[0]));
            S_list.push(parseInt(values[1]));
            I_list.push(parseInt(values[2]));
            R_list.push(parseInt(values[3]));
            E_m_list.push(parseInt(values[4]));
            I_m_list.push(parseInt(values[5]));
        }
        
        // Create the plot
        const humanTraces = [
            {
                x: days,
                y: S_list,
                name: 'Susceptible (Humans)',
                type: 'scatter',
                mode: 'lines'
            },
            {
                x: days,
                y: I_list,
                name: 'Infected (Humans)',
                type: 'scatter',
                mode: 'lines'
            },
            {
                x: days,
                y: R_list,
                name: 'Recovered (Humans)',
                type: 'scatter',
                mode: 'lines'
            }
        ];
        
        const mosquitoTraces = [
            {
                x: days,
                y: E_m_list,
                name: 'Exposed Mosquitoes',
                type: 'scatter',
                mode: 'lines',
                line: {dash: 'dash'},
                yaxis: 'y2'
            },
            {
                x: days,
                y: I_m_list,
                name: 'Infectious Mosquitoes',
                type: 'scatter',
                mode: 'lines',
                line: {dash: 'dot'},
                yaxis: 'y2'
            }
        ];
        
        const layout = {
            title: 'Global Malaria Transmission Dynamics',
            xaxis: {title: 'Days'},
            yaxis: {title: 'Human Population', side: 'left'},
            yaxis2: {
                title: 'Mosquito Population',
                side: 'right',
                overlaying: 'y'
            },
            legend: {x: 1.05, y: 1},
            height: 500
        };
        
        Plotly.newPlot('globalGraph', [...humanTraces, ...mosquitoTraces], layout);
    }
    
    function plotHouseInfected(data) {
        // Parse the CSV data
        const lines = data.trim().split('\n');
        const headers = lines[0].split(',');
        
        // Group by house ID
        const houseData = {};
        
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',');
            const day = parseInt(values[0]);
            const houseID = parseInt(values[1]);
            const infected = parseInt(values[2]);
            
            if (!houseData[houseID]) {
                houseData[houseID] = [];
            }
            
            houseData[houseID].push([day, infected]);
        }
        
        // Create traces for first 5 houses
        const traces = [];
        const housesToPlot = [0, 1, 2, 3, 4];
        
        for (const houseID of housesToPlot) {
            if (houseData[houseID]) {
                // Sort by day
                const sortedData = houseData[houseID].sort((a, b) => a[0] - b[0]);
                const days = sortedData.map(d => d[0]);
                const infected = sortedData.map(d => d[1]);
                
                traces.push({
                    x: days,
                    y: infected,
                    name: `House ${houseID}`,
                    type: 'scatter',
                    mode: 'lines'
                });
            }
        }
        
        const layout = {
            title: 'House-Level Infected Dynamics',
            xaxis: {title: 'Days'},
            yaxis: {title: 'Infected Humans'},
            height: 500
        };
        
        Plotly.newPlot('houseGraph', traces, layout);
    }
}); 