document.getElementById('simulationForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const loadingSpinner = document.getElementById('loadingSpinner');
    const graphsContainer = document.getElementById('graphs');
    
    // Show loading spinner
    loadingSpinner.classList.remove('hidden');
    graphsContainer.innerHTML = '';
    
    // Get form data
    const formData = {
        humanPopulation: parseInt(document.getElementById('humanPopulation').value),
        mosquitoPopulation: parseInt(document.getElementById('mosquitoPopulation').value),
        houses: parseInt(document.getElementById('houses').value),
        temperature: parseFloat(document.getElementById('temperature').value),
        days: parseInt(document.getElementById('days').value)
    };
    
    console.log("Sending data:", formData);
    
    try {
        const response = await fetch('/run-simulation', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData),
        });
        
        const data = await response.json();
        console.log("Received data:", data);
        
        if (data.success) {
            // Create graph containers
            graphsContainer.innerHTML = `
                <div id="populationGraph" style="width:800px;height:500px;"></div>
                <div id="infectionGraph" style="width:800px;height:500px;"></div>
            `;
            
            // Plot the data using Plotly
            Plotly.newPlot(
                'populationGraph', 
                data.plots.population.data,
                data.plots.population.layout
            );
            
            Plotly.newPlot(
                'infectionGraph', 
                data.plots.infection.data,
                data.plots.infection.layout
            );
            
            console.log("Plots rendered");
        } else {
            throw new Error(data.error || 'Unknown error occurred');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error running simulation: ' + error.message);
    } finally {
        loadingSpinner.classList.add('hidden');
    }
}); 