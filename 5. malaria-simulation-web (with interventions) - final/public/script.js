document.addEventListener('DOMContentLoaded', function() {
    const runButton = document.getElementById('runSimulation');
    const statusDiv = document.getElementById('status');
    const loader = document.getElementById('loader');
    
    // Store baseline and intervention results
    let baselineResults = null;
    let interventionResults = null;
    
    let savedSimulation = null;
    const compareButton = document.createElement('button');
    compareButton.id = 'compareSimulation';
    compareButton.textContent = 'Save for Comparison';
    compareButton.style.display = 'none';
    
    // NEW: Store multiple simulation results
    let simulationHistory = [];
    
    // Set up preset buttons
    const presetButtons = document.querySelectorAll('.preset-btn');
    presetButtons.forEach(button => {
        button.addEventListener('click', function() {
            const preset = this.getAttribute('data-preset');
            applyPreset(preset);
        });
    });
    
    // Apply preset values
    function applyPreset(preset) {
        switch(preset) {
            case 'urban':
                document.getElementById('humanPopulation').value = 20000;
                document.getElementById('mosquitoPopulation').value = 15000;
                document.getElementById('numHouses').value = 200;
                document.getElementById('temperature').value = 28;
                // Reset interventions
                document.getElementById('itnCoverage').value = 0;
                document.getElementById('treatmentRate').value = 0;
                break;
            case 'rural':
                document.getElementById('humanPopulation').value = 5000;
                document.getElementById('mosquitoPopulation').value = 20000;
                document.getElementById('numHouses').value = 50;
                document.getElementById('temperature').value = 26;
                // Reset interventions
                document.getElementById('itnCoverage').value = 0;
                document.getElementById('treatmentRate').value = 0;
                break;
            case 'epidemic':
                document.getElementById('humanPopulation').value = 10000;
                document.getElementById('mosquitoPopulation').value = 30000;
                document.getElementById('numHouses').value = 100;
                document.getElementById('temperature').value = 30;
                // Reset interventions
                document.getElementById('itnCoverage').value = 0;
                document.getElementById('treatmentRate').value = 0;
                break;
            case 'intervention1':
                // Apply bed nets intervention
                document.getElementById('itnCoverage').value = 0.7;
                document.getElementById('treatmentRate').value = 0;
                // Run with intervention if baseline exists
                if (baselineResults) {
                    runSimulationWithParams(false);
                } else {
                    statusDiv.textContent = 'Please run a baseline simulation first';
                }
                return; // Skip the normal run
            case 'intervention2':
                // Apply treatment intervention
                document.getElementById('itnCoverage').value = 0;
                document.getElementById('treatmentRate').value = 0.7;
                // Run with intervention if baseline exists
                if (baselineResults) {
                    runSimulationWithParams(false);
                } else {
                    statusDiv.textContent = 'Please run a baseline simulation first';
                }
                return; // Skip the normal run
        }
        
        // For non-intervention presets, run the simulation
        runSimulationWithParams(true);
    }
    
    // Main run simulation button
    runButton.addEventListener('click', function() {
        runSimulationWithParams(true);
    });
    
    // Run simulation with parameters
    function runSimulationWithParams(isBaseline) {
        // Get user input values
        const humanPopulation = document.getElementById('humanPopulation').value;
        const mosquitoPopulation = document.getElementById('mosquitoPopulation').value;
        const numHouses = document.getElementById('numHouses').value;
        const temperature = document.getElementById('temperature').value;
        const numDays = document.getElementById('numDays').value;
        
        // Get intervention parameters
        const itnCoverage = document.getElementById('itnCoverage').value;
        const treatmentRate = document.getElementById('treatmentRate').value;
        
        // Validate inputs
        if (!humanPopulation || !mosquitoPopulation || !numHouses || !temperature || !numDays) {
            statusDiv.textContent = 'Please fill in all fields';
            return;
        }
        
        // Show loading state
        statusDiv.textContent = isBaseline ? 'Running simulation...' : 'Running with interventions...';
        loader.style.display = 'block';
        
        // Prepare data for API call
        const simulationData = {
            humanPopulation: parseInt(humanPopulation),
            mosquitoPopulation: parseInt(mosquitoPopulation),
            numHouses: parseInt(numHouses),
            temperature: parseFloat(temperature),
            numDays: parseInt(numDays),
            // Include intervention parameters
            itnCoverage: parseFloat(itnCoverage),
            itnEfficacy: 0.7, // Fixed value
            treatmentRate: parseFloat(treatmentRate)
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
            loader.style.display = 'none';
            
            // NEW: Create a simulation record with parameters and results
            const simulationRecord = {
                params: {
                    ...simulationData,
                    isBaseline: isBaseline
                },
                data: data,
                label: generateSimulationLabel(simulationData)
            };
            
            // Add to history
            simulationHistory.push(simulationRecord);
            
            if (isBaseline || !baselineResults) {
                statusDiv.textContent = 'Simulation completed. You can now add interventions using the preset buttons.';
                baselineResults = data;
                
                // Plot baseline results
            plotGlobalStats(data.globalStats);
            plotHouseInfected(data.houseStats);
            plotHeatmap(data.houseStats);
            } else {
                statusDiv.textContent = 'Intervention simulation completed. Compare with baseline.';
                interventionResults = data;
            }
            
            // NEW: Always update the multi-simulation comparison graph
            plotMultiSimulationComparison();
        })
        .catch(error => {
            loader.style.display = 'none';
            statusDiv.textContent = 'Error running simulation: ' + error.message;
            console.error('Error:', error);
        });
    }
    
    // NEW: Generate a descriptive label for the simulation
    function generateSimulationLabel(params) {
        let label = `Pop:${params.humanPopulation}`;
        
        if (params.itnCoverage > 0) {
            label += `, Protected Houses:${params.itnCoverage * 100}%`;
        }
        
        if (params.treatmentRate > 0) {
            label += `, Treated:${params.treatmentRate * 100}%`;
        }
        
        return label;
    }
    
    // NEW: Plot comparison of infected humans across multiple simulations
    function plotMultiSimulationComparison() {
        const comparisonDiv = document.getElementById('interventionComparisonGraph');
        
        // Create traces for each simulation, focusing only on infected humans
        const traces = simulationHistory.map((sim, index) => {
            // Parse CSV data
            const rows = sim.data.globalStats.trim().split('\n');
            const data = rows.slice(1).map(row => {
                const values = row.split(',');
                return {
                    day: parseInt(values[0]),
                    I: parseInt(values[2]) // Infected count is in the 3rd column (index 2)
                };
            });
            
            // Generate a color based on index
            const colors = ['red', 'blue', 'green', 'purple', 'orange', 'brown', 'pink', 'gray'];
            const color = colors[index % colors.length];
            
            // Create trace for infected humans
            return {
                x: data.map(d => d.day),
                y: data.map(d => d.I),
                name: sim.label,
                type: 'scatter',
                mode: 'lines',
                line: { 
                    color: color, 
                    width: 2,
                    dash: sim.params.isBaseline ? 'solid' : 'dash'
                }
            };
        });
        
        const layout = {
            title: 'Comparison of Infected Humans Across Simulations',
            xaxis: {
                title: 'Day'
            },
            yaxis: {
                title: 'Number of Infected People'
            },
            height: 500,
            margin: { t: 50, r: 50, b: 50, l: 50 },
            legend: {
                x: 0,
                y: 1
            }
        };
        
        Plotly.newPlot(comparisonDiv, traces, layout);
    }
    
    // Keep the existing plotInterventionComparison function for backward compatibility
    // but we'll use the new plotMultiSimulationComparison for the actual display
    function plotInterventionComparison(baselineCSV, interventionCSV) {
        // This function is now effectively replaced by plotMultiSimulationComparison
        // but we keep it to avoid breaking existing code
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
    
    // Function to plot spatial heatmap with bubbles and time slider
    function plotHeatmap(houseStatsCSV) {
        const heatmapDiv = document.getElementById('heatmapGraph');
        
        // Parse CSV data
        const rows = houseStatsCSV.trim().split('\n');
        const headers = rows[0].split(',');
        
        // Get unique days
        const days = [...new Set(rows.slice(1).map(row => parseInt(row.split(',')[0])))];
        const maxDay = Math.max(...days);
        
        // Group data by day
        const dataByDay = {};
        days.forEach(day => {
            dataByDay[day] = rows.slice(1)
                .filter(row => parseInt(row.split(',')[0]) === day)
                .map(row => {
                    const values = row.split(',');
                    return {
                        houseID: parseInt(values[1]),
                        infected: parseInt(values[2]),
                        x: parseFloat(values[3]),
                        y: parseFloat(values[4]),
                        hasITN: parseInt(values[5])
                    };
                });
        });
        
        // Create frames for animation
        const frames = days.map(day => {
            const dayData = dataByDay[day];
            
            return {
                name: day,
                data: [
                    {
                        x: dayData.map(d => d.x),
                        y: dayData.map(d => d.y),
                        mode: 'markers',
                        marker: {
                            size: dayData.map(d => Math.max(5, d.infected * 3)),
                            color: dayData.map(d => d.infected),
                            colorscale: 'Reds',
                            showscale: true,
                            colorbar: {
                                title: 'Infected Count'
                            },
                            line: {
                                color: dayData.map(d => d.hasITN ? 'blue' : 'gray'),
                                width: dayData.map(d => d.hasITN ? 3 : 1)
                            }
                        },
                        text: dayData.map(d => `House ${d.houseID}<br>Infected: ${d.infected}<br>${d.hasITN ? 'Protected by ITN (No Mosquitoes)' : 'Not Protected'}`),
                        hoverinfo: 'text'
                    }
                ]
            };
        });
        
        // Initial data (day 0)
        const initialData = [
            {
                x: dataByDay[0].map(d => d.x),
                y: dataByDay[0].map(d => d.y),
                mode: 'markers',
                marker: {
                    size: dataByDay[0].map(d => Math.max(5, d.infected * 3)),
                    color: dataByDay[0].map(d => d.infected),
                    colorscale: 'Reds',
                    showscale: true,
                    colorbar: {
                        title: 'Infected Count'
                    },
                    line: {
                        color: dataByDay[0].map(d => d.hasITN ? 'blue' : 'gray'),
                        width: dataByDay[0].map(d => d.hasITN ? 3 : 1)
                    }
                },
                text: dataByDay[0].map(d => `House ${d.houseID}<br>Infected: ${d.infected}<br>${d.hasITN ? 'Protected by ITN (No Mosquitoes)' : 'Not Protected'}`),
                hoverinfo: 'text'
            }
        ];
        
        // Create slider steps
        const sliderSteps = days.map(day => {
            return {
                method: 'animate',
                label: day.toString(),
                args: [
                    [day],
                    {
                        frame: { duration: 300, redraw: true },
                        transition: { duration: 300 },
                        mode: 'immediate'
                    }
                ]
            };
        });
        
        // Layout with slider
        const layout = {
            title: 'Spatial Distribution of Infections',
            xaxis: {
                title: 'X Coordinate',
                range: [0, 100]
            },
            yaxis: {
                title: 'Y Coordinate',
                range: [0, 100]
            },
            height: 600,
            margin: { t: 50, r: 50, b: 100, l: 50 },
            hovermode: 'closest',
            sliders: [{
                pad: { l: 130, t: 30 },
                currentvalue: {
                    visible: true,
                    prefix: 'Day: ',
                    xanchor: 'right',
                    font: { size: 20, color: '#666' }
                },
                steps: sliderSteps
            }],
            updatemenus: [{
                type: 'buttons',
                showactive: false,
                x: 0.1,
                y: 0,
                xanchor: 'right',
                yanchor: 'top',
                pad: { t: 60, r: 10 },
                buttons: [{
                    label: 'Play',
                    method: 'animate',
                    args: [
                        null,
                        {
                            fromcurrent: true,
                            frame: { duration: 300, redraw: true },
                            transition: { duration: 300 }
                        }
                    ]
                }, {
                    label: 'Pause',
                    method: 'animate',
                    args: [
                        [null],
                        {
                            mode: 'immediate',
                            transition: { duration: 0 },
                            frame: { duration: 0, redraw: true }
                        }
                    ]
                }]
            }]
        };
        
        // Create the plot with animation
        Plotly.newPlot(heatmapDiv, initialData, layout).then(function() {
            Plotly.addFrames(heatmapDiv, frames);
        });
    }
    
    // Make sure to call createTimeSlider function if it exists
    function createTimeSlider(houseStatsCSV) {
        // This function might be redundant now that the slider is integrated into the plotHeatmap function
        // If there's additional functionality needed, it can be implemented here
    }
    
    function addExportButtons() {
        // Create export buttons container
        const exportContainer = document.createElement('div');
        exportContainer.className = 'export-container';
        
        // Create global stats export button
        const exportGlobalBtn = document.createElement('button');
        exportGlobalBtn.textContent = 'Export Global Stats';
        exportGlobalBtn.className = 'export-btn';
        exportGlobalBtn.onclick = function() {
            const csvContent = window.globalStatsData || '';
            if (csvContent) {
                downloadCSV(csvContent, 'global_stats.csv');
            } else {
                alert('No data available to export');
            }
        };
        
        // Create house stats export button
        const exportHouseBtn = document.createElement('button');
        exportHouseBtn.textContent = 'Export House Stats';
        exportHouseBtn.className = 'export-btn';
        exportHouseBtn.onclick = function() {
            const csvContent = window.houseStatsData || '';
            if (csvContent) {
                downloadCSV(csvContent, 'house_stats.csv');
            } else {
                alert('No data available to export');
            }
        };
        
        // Add buttons to container
        exportContainer.appendChild(exportGlobalBtn);
        exportContainer.appendChild(exportHouseBtn);
        
        // Add container to results section
        document.querySelector('.results-container').appendChild(exportContainer);
    }
    
    function downloadCSV(csvContent, filename) {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    function createSummaryStats(globalStats) {
        // Parse the CSV data
        const lines = globalStats.trim().split('\n');
        const lastLine = lines[lines.length - 1].split(',');
        
        // Get final day values
        const finalDay = parseInt(lastLine[0]);
        const finalS = parseInt(lastLine[1]);
        const finalI = parseInt(lastLine[2]);
        const finalR = parseInt(lastLine[3]);
        const finalEm = parseInt(lastLine[4]);
        const finalIm = parseInt(lastLine[5]);
        
        // Calculate peak infection
        let peakInfection = 0;
        let peakDay = 0;
        
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',');
            const day = parseInt(values[0]);
            const infected = parseInt(values[2]);
            
            if (infected > peakInfection) {
                peakInfection = infected;
                peakDay = day;
            }
        }
        
        // Create summary container
        const summaryContainer = document.createElement('div');
        summaryContainer.className = 'summary-container';
        summaryContainer.innerHTML = `
            <h3>Simulation Summary</h3>
            <div class="summary-grid">
                <div class="summary-item">
                    <span class="summary-label">Peak Infection:</span>
                    <span class="summary-value">${peakInfection} humans (Day ${peakDay})</span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">Final Susceptible:</span>
                    <span class="summary-value">${finalS} humans</span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">Final Infected:</span>
                    <span class="summary-value">${finalI} humans</span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">Final Recovered:</span>
                    <span class="summary-value">${finalR} humans</span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">Final Infectious Mosquitoes:</span>
                    <span class="summary-value">${finalIm} mosquitoes</span>
                </div>
            </div>
        `;
        
        // Insert after the global graph
        const globalGraph = document.getElementById('globalGraph');
        globalGraph.parentNode.insertBefore(summaryContainer, globalGraph.nextSibling);
    }

    function compareGlobalStats(savedData, currentData) {
        // Parse the saved CSV data
        const savedLines = savedData.trim().split('\n');
        const savedDays = [];
        const savedInfected = [];
        
        for (let i = 1; i < savedLines.length; i++) {
            const values = savedLines[i].split(',');
            savedDays.push(parseInt(values[0]));
            savedInfected.push(parseInt(values[2])); // Infected humans
        }
        
        // Parse the current CSV data
        const currentLines = currentData.trim().split('\n');
        const currentDays = [];
        const currentInfected = [];
        
        for (let i = 1; i < currentLines.length; i++) {
            const values = currentLines[i].split(',');
            currentDays.push(parseInt(values[0]));
            currentInfected.push(parseInt(values[2])); // Infected humans
        }
        
        // Create the comparison plot
        const traces = [
            {
                x: savedDays,
                y: savedInfected,
                name: 'Previous Simulation',
                type: 'scatter',
                mode: 'lines',
                line: {
                    color: 'blue',
                    width: 2
                }
            },
            {
                x: currentDays,
                y: currentInfected,
                name: 'Current Simulation',
                type: 'scatter',
                mode: 'lines',
                line: {
                    color: 'red',
                    width: 2
                }
            }
        ];
        
        // Create a new div for the comparison graph
        const comparisonDiv = document.createElement('div');
        comparisonDiv.id = 'comparisonGraph';
        comparisonDiv.className = 'graph-container';
        comparisonDiv.innerHTML = '<h3>Simulation Comparison</h3><div id="comparisonPlot"></div>';
        
        // Add it to the results container
        document.querySelector('.results-container').appendChild(comparisonDiv);
        
        const layout = {
            title: 'Comparison of Infected Humans Between Simulations',
            xaxis: {title: 'Days'},
            yaxis: {title: 'Infected Humans'},
            height: 500
        };
        
        Plotly.newPlot('comparisonPlot', traces, layout);
    }

    compareButton.addEventListener('click', function() {
        if (!savedSimulation) {
            // Save the current simulation
            savedSimulation = {
                globalStats: window.globalStatsData,
                params: {
                    humanPopulation: document.getElementById('humanPopulation').value,
                    mosquitoPopulation: document.getElementById('mosquitoPopulation').value,
                    numHouses: document.getElementById('numHouses').value,
                    temperature: document.getElementById('temperature').value,
                    numDays: document.getElementById('numDays').value
                }
            };
            compareButton.textContent = 'Run New Simulation to Compare';
            statusDiv.textContent = 'Simulation saved for comparison. Run a new simulation with different parameters to compare.';
        } else {
            // Compare with the saved simulation
            compareGlobalStats(savedSimulation.globalStats, window.globalStatsData);
            compareButton.textContent = 'Save for Comparison';
            savedSimulation = null;
        }
    });
}); 