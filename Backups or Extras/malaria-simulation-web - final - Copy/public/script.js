document.addEventListener('DOMContentLoaded', function() {
    const runButton = document.getElementById('runSimulation');
    const statusDiv = document.getElementById('status');
    const loader = document.getElementById('loader');
    
    let savedSimulation = null;
    const compareButton = document.createElement('button');
    compareButton.id = 'compareSimulation';
    compareButton.textContent = 'Save for Comparison';
    compareButton.style.display = 'none';
    
    runButton.addEventListener('click', function() {
        // Get user input values
        const humanPopulation = document.getElementById('humanPopulation').value;
        const mosquitoPopulation = document.getElementById('mosquitoPopulation').value;
        const numHouses = document.getElementById('numHouses').value;
        const temperature = document.getElementById('temperature').value;
        const numDays = document.getElementById('numDays').value;
        
        // Validate inputs
        if (!humanPopulation || !mosquitoPopulation || !numHouses || !temperature || !numDays) {
            statusDiv.textContent = 'Please fill in all fields';
            return;
        }
        
        // Show loading state
        statusDiv.textContent = 'Running simulation...';
        loader.style.display = 'block';
        
        // Prepare data for API call
        const simulationData = {
            humanPopulation: parseInt(humanPopulation),
            mosquitoPopulation: parseInt(mosquitoPopulation),
            numHouses: parseInt(numHouses),
            temperature: parseFloat(temperature),
            numDays: parseInt(numDays)
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
            statusDiv.textContent = 'Simulation completed successfully!';
            
            // Store the CSV data for export
            window.globalStatsData = data.globalStats;
            window.houseStatsData = data.houseStats;
            
            // Plot the results
            plotGlobalStats(data.globalStats);
            plotHouseInfected(data.houseStats);
            plotHeatmap(data.houseStats);
            createTimeSlider(data.houseStats);
            
            // Create summary stats
            createSummaryStats(data.globalStats);
            
            // Add export buttons
            addExportButtons();
            
            // Show the compare button
            compareButton.style.display = 'block';
        })
        .catch(error => {
            loader.style.display = 'none';
            statusDiv.textContent = 'Error running simulation: ' + error.message;
            console.error('Error:', error);
        });
    });
    
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
    
    function plotHeatmap(data) {
        // Parse the CSV data
        const lines = data.trim().split('\n');
        
        // Get the number of houses from the data
        const houseSet = new Set();
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',');
            const houseID = parseInt(values[1]);
            houseSet.add(houseID);
        }
        const numHouses = houseSet.size;
        
        // Calculate grid dimensions (try to make it somewhat square)
        const gridSize = Math.ceil(Math.sqrt(numHouses));
        
        // Create a matrix to hold the last day's infection data
        const lastDay = parseInt(lines[lines.length - 1].split(',')[0]);
        
        // Create arrays for the 2D scatter plot
        const x = [];
        const y = [];
        const houseIDs = [];
        const infectionCounts = [];
        const hoverTexts = [];
        const markerSizes = [];
        
        // Get the last day's data for each house
        const lastDayData = {};
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',');
            const day = parseInt(values[0]);
            const houseID = parseInt(values[1]);
            const infected = parseInt(values[2]);
            
            if (day === lastDay) {
                lastDayData[houseID] = infected;
            }
        }
        
        // Create the 2D grid layout
        for (let houseID = 0; houseID < numHouses; houseID++) {
            // Calculate grid position
            const row = Math.floor(houseID / gridSize);
            const col = houseID % gridSize;
            
            x.push(col);
            y.push(row);
            houseIDs.push(houseID);
            
            const infected = lastDayData[houseID] || 0;
            infectionCounts.push(infected);
            
            // Create hover text
            hoverTexts.push(`House ID: ${houseID}<br>Infected: ${infected}`);
            
            // Scale marker size based on infection count (with a minimum size)
            markerSizes.push(Math.max(10, infected * 2));
        }
        
        // Create the 2D scatter plot
        const scatterPlot = [{
            x: x,
            y: y,
            mode: 'markers+text',
            type: 'scatter',
            text: houseIDs,
            textposition: 'center',
            textfont: {
                color: 'white',
                size: 10
            },
            marker: {
                size: markerSizes,
                color: infectionCounts,
                colorscale: 'Reds',
                showscale: true,
                colorbar: {
                    title: 'Infected Humans',
                    thickness: 20
                }
            },
            hovertext: hoverTexts,
            hoverinfo: 'text'
        }];
        
        const layout = {
            title: 'Spatial Distribution of Infections (Day ' + lastDay + ')',
            height: 600,
            width: 600,
            xaxis: {
                title: 'Column',
                showgrid: true,
                zeroline: false,
                range: [-1, gridSize]
            },
            yaxis: {
                title: 'Row',
                showgrid: true,
                zeroline: false,
                range: [gridSize, -1]  // Reverse the y-axis to match traditional grid layout
            },
            margin: {
                l: 50,
                r: 50,
                b: 50,
                t: 80
            }
        };
        
        Plotly.newPlot('heatmapGraph', scatterPlot, layout);
    }
    
    function createTimeSlider(data) {
        // Parse the CSV data
        const lines = data.trim().split('\n');
        
        // Get unique days
        const daysSet = new Set();
        for (let i = 1; i < lines.length; i++) {
            const day = parseInt(lines[i].split(',')[0]);
            daysSet.add(day);
        }
        const days = Array.from(daysSet).sort((a, b) => a - b);
        
        // Create slider container
        const sliderContainer = document.createElement('div');
        sliderContainer.className = 'slider-container';
        
        // Create slider elements
        const sliderLabel = document.createElement('label');
        sliderLabel.textContent = 'Day: ';
        sliderLabel.htmlFor = 'daySlider';
        
        const dayDisplay = document.createElement('span');
        dayDisplay.id = 'currentDay';
        dayDisplay.textContent = days[0];
        
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.id = 'daySlider';
        slider.min = 0;
        slider.max = days.length - 1;
        slider.value = 0;
        
        // Add elements to container
        sliderContainer.appendChild(sliderLabel);
        sliderContainer.appendChild(dayDisplay);
        sliderContainer.appendChild(slider);
        
        // Add slider to page
        const heatmapContainer = document.getElementById('heatmapGraph').parentNode;
        heatmapContainer.insertBefore(sliderContainer, document.getElementById('heatmapGraph'));
        
        // Store the data for the slider
        window.timeSliderData = {
            days: days,
            houseData: {}
        };
        
        // Process data for each day
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',');
            const day = parseInt(values[0]);
            const houseID = parseInt(values[1]);
            const infected = parseInt(values[2]);
            
            if (!window.timeSliderData.houseData[day]) {
                window.timeSliderData.houseData[day] = {};
            }
            
            window.timeSliderData.houseData[day][houseID] = infected;
        }
        
        // Add event listener for slider
        slider.addEventListener('input', function() {
            const selectedDayIndex = parseInt(this.value);
            const selectedDay = days[selectedDayIndex];
            dayDisplay.textContent = selectedDay;
            
            // Update heatmap for the selected day
            updateHeatmapForDay(selectedDay);
        });
    }
    
    // Function to update heatmap for a specific day
    function updateHeatmapForDay(day) {
        if (!window.timeSliderData) return;
        
        const dayData = window.timeSliderData.houseData[day] || {};
        const numHouses = Object.keys(window.timeSliderData.houseData[window.timeSliderData.days[0]]).length;
        const gridSize = Math.ceil(Math.sqrt(numHouses));
        
        // Create arrays for the 2D scatter plot
        const x = [];
        const y = [];
        const houseIDs = [];
        const infectionCounts = [];
        const hoverTexts = [];
        const markerSizes = [];
        
        // Create the 2D grid layout
        for (let houseID = 0; houseID < numHouses; houseID++) {
            // Calculate grid position
            const row = Math.floor(houseID / gridSize);
            const col = houseID % gridSize;
            
            x.push(col);
            y.push(row);
            houseIDs.push(houseID);
            
            const infected = dayData[houseID] || 0;
            infectionCounts.push(infected);
            
            // Create hover text
            hoverTexts.push(`House ID: ${houseID}<br>Infected: ${infected}`);
            
            // Scale marker size based on infection count (with a minimum size)
            markerSizes.push(Math.max(10, infected * 2));
        }
        
        // Update the scatter plot
        Plotly.update('heatmapGraph', {
            x: [x],
            y: [y],
            text: [houseIDs],
            marker: {
                size: markerSizes,
                color: infectionCounts
            },
            hovertext: [hoverTexts]
        }, {
            title: 'Spatial Distribution of Infections (Day ' + day + ')'
        });
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

    function setupPresets() {
        const presetButtons = document.querySelectorAll('.preset-btn');
        
        const presets = {
            urban: {
                humanPopulation: 20000,
                mosquitoPopulation: 5000,
                numHouses: 200,
                temperature: 28,
                numDays: 500
            },
            rural: {
                humanPopulation: 5000,
                mosquitoPopulation: 15000,
                numHouses: 50,
                temperature: 26,
                numDays: 500
            },
            epidemic: {
                humanPopulation: 10000,
                mosquitoPopulation: 30000,
                numHouses: 100,
                temperature: 30,
                numDays: 500
            }
        };
        
        presetButtons.forEach(button => {
            button.addEventListener('click', function() {
                const presetName = this.getAttribute('data-preset');
                const preset = presets[presetName];
                
                if (preset) {
                    document.getElementById('humanPopulation').value = preset.humanPopulation;
                    document.getElementById('mosquitoPopulation').value = preset.mosquitoPopulation;
                    document.getElementById('numHouses').value = preset.numHouses;
                    document.getElementById('temperature').value = preset.temperature;
                    document.getElementById('numDays').value = preset.numDays;
                    
                    statusDiv.textContent = `Loaded ${presetName} preset`;
                }
            });
        });
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

    setupPresets();
}); 