const express = require('express');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// API endpoint to run the simulation
app.post('/api/run-simulation', (req, res) => {
    const { humanPopulation, mosquitoPopulation, numHouses, temperature, numDays } = req.body;
    
    // Add timeout handling
    const requestTimeout = setTimeout(() => {
        console.error('Request timed out after 120 seconds');
        return res.status(504).json({ error: 'Simulation timed out. Try with smaller parameters.' });
    }, 120000); // 2 minute timeout
    
    // Create a temporary C file with the modified parameters
    const tempCFile = path.join(__dirname, 'temp_simulation.c');
    const originalCFile = path.join(__dirname, 'code.c');
    
    // Read the original C file
    fs.readFile(originalCFile, 'utf8', (err, data) => {
        if (err) {
            clearTimeout(requestTimeout);
            console.error('Error reading C file:', err);
            return res.status(500).json({ error: 'Failed to read simulation code' });
        }
        
        // Replace the parameters in the C code
        let modifiedCode = data
            .replace(/#define NUM_HUMANS\s+\d+/, `#define NUM_HUMANS        ${humanPopulation}`)
            .replace(/#define NUM_MOSQUITOES\s+\d+/, `#define NUM_MOSQUITOES    ${mosquitoPopulation}`)
            .replace(/#define NUM_HOUSES\s+\d+/, `#define NUM_HOUSES        ${numHouses}`)
            .replace(/#define DAYS\s+\d+/, `#define DAYS              ${numDays}`);
            
        // Adjust mosquito parameters based on temperature
        // This is a simple model - you might want to use a more sophisticated relationship
        const bitingAdjustment = 0.3 * (1 + (temperature - 25) * 0.05);  // Increase biting at higher temps
        const mortalityAdjustment = 0.1 * (1 - (temperature - 25) * 0.03);  // Decrease mortality at higher temps
        
        modifiedCode = modifiedCode
            .replace(/#define DAILY_BITING_PROB\s+[\d\.]+/, `#define DAILY_BITING_PROB ${bitingAdjustment.toFixed(2)}`)
            .replace(/#define MOSQ_MORTALITY\s+[\d\.]+/, `#define MOSQ_MORTALITY    ${mortalityAdjustment.toFixed(2)}`);
        
        // Write the modified code to a temporary file
        fs.writeFile(tempCFile, modifiedCode, (err) => {
            if (err) {
                clearTimeout(requestTimeout);
                console.error('Error writing temporary C file:', err);
                return res.status(500).json({ error: 'Failed to prepare simulation' });
            }
            
            // Compile and run the C program with proper path handling for Windows
            const executableExt = process.platform === 'win32' ? '.exe' : '';
            const tempExecutable = path.join(__dirname, `temp_simulation${executableExt}`);
            const compileCmd = `gcc "${tempCFile}" -o "${tempExecutable}" -lm`;
            const runCmd = `"${tempExecutable}"`;
            
            console.log(`Executing: ${compileCmd} && ${runCmd}`);
            
            // First compile
            exec(compileCmd, { timeout: 30000 }, (compileErr, stdout, stderr) => {
                if (compileErr) {
                    clearTimeout(requestTimeout);
                    console.error('Error compiling simulation:', compileErr);
                    return res.status(500).json({ error: 'Simulation compilation failed: ' + stderr });
                }
                
                // Then run if compilation succeeded
                const childProcess = exec(runCmd, { 
                    cwd: __dirname,
                    timeout: 60000 // 1 minute timeout for execution
                }, (runErr, stdout, stderr) => {
                    // Clean up the temporary files
                    try {
                        fs.unlinkSync(tempCFile);
                        fs.unlinkSync(tempExecutable);
                    } catch (cleanupErr) {
                        console.error('Error cleaning up temporary files:', cleanupErr);
                    }
                    
                    clearTimeout(requestTimeout);
                    
                    if (runErr) {
                        console.error('Error running simulation:', runErr);
                        return res.status(500).json({ error: 'Simulation execution failed: ' + stderr });
                    }
                    
                    console.log('Simulation output:', stdout);
                    
                    // Read the CSV files
                    try {
                        const globalStats = fs.readFileSync(path.join(__dirname, 'global_stats.csv'), 'utf8');
                        const houseStats = fs.readFileSync(path.join(__dirname, 'house_infected.csv'), 'utf8');
                        
                        // Send the data back to the client
                        res.json({
                            success: true,
                            globalStats,
                            houseStats
                        });
                    } catch (readErr) {
                        console.error('Error reading CSV files:', readErr);
                        res.status(500).json({ error: 'Failed to read simulation results' });
                    }
                });
                
                // Add event listeners for additional error handling
                childProcess.on('error', (err) => {
                    clearTimeout(requestTimeout);
                    console.error('Child process error:', err);
                    res.status(500).json({ error: 'Process execution error: ' + err.message });
                });
            });
        });
    });
});

// Add a simple route to check if server is running
app.get('/api/status', (req, res) => {
    res.json({ status: 'Server is running' });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Original C file path: ${path.join(__dirname, 'code.c')}`);
    console.log(`Verify this file exists before running simulations`);
}); 