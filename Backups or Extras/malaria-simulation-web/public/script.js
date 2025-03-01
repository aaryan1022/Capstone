document.addEventListener('DOMContentLoaded', function() {
    const runButton = document.getElementById('runSimulation');
    const statusDiv = document.getElementById('status');
    const loader = document.getElementById('loader');
    
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
            
            // Plot the results
            plotGlobalStats(data.globalStats);
            plotHouseInfected(data.houseStats);
        })
        .catch(error => {
            loader.style.display = 'none';
            statusDiv.textContent = 'Error running simulation: ' + error.message;
            console.error('Error:', error);
        });
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
}); 