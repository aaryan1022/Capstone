from flask import Flask, request, jsonify, send_from_directory
import subprocess
import pandas as pd
import plotly.express as px
import json
import logging
import os

logging.basicConfig(level=logging.DEBUG)

app = Flask(__name__, static_folder='static')

@app.route('/')
def home():
    return send_from_directory('static', 'index.html')

@app.route('/run-simulation', methods=['POST'])
def run_simulation():
    data = request.json
    
    logging.debug(f"Received data: {data}")
    
    # Run the C program with the input parameters
    try:
        # Update NUM_HUMANS, NUM_MOSQUITOES, and NUM_HOUSES in the C program
        with open('MalariaModel.c', 'r') as f:
            c_code = f.read()
        
        # Replace the define statements with more precise patterns
        c_code = c_code.replace('#define NUM_HUMANS        20000', f'#define NUM_HUMANS        {data["humanPopulation"]}')
        c_code = c_code.replace('#define NUM_MOSQUITOES    20000', f'#define NUM_MOSQUITOES    {data["mosquitoPopulation"]}')
        c_code = c_code.replace('#define NUM_HOUSES        100', f'#define NUM_HOUSES        {data["houses"]}')
        c_code = c_code.replace('#define DAYS              50', f'#define DAYS              {data["days"]}')
        
        # Change HOURLY_BITING_PROB from a macro to a variable
        c_code = c_code.replace('#define HOURLY_BITING_PROB (DAILY_BITING_PROB / (double)HOURS_PER_DAY)', 
                               'float HOURLY_BITING_PROB = DAILY_BITING_PROB / (double)HOURS_PER_DAY;')
        
        # Write the modified code
        with open('MalariaModel_temp.c', 'w') as f:
            f.write(c_code)
        
        logging.debug("Modified C code written to MalariaModel_temp.c")
        
        # Compile and run the modified code with detailed output capture
        compile_result = subprocess.run(['gcc', 'MalariaModel_temp.c', '-lm', '-o', 'mosquito_sim'], 
                                       capture_output=True, text=True, check=False)
        
        if compile_result.returncode != 0:
            logging.error(f"Compilation error: {compile_result.stderr}")
            return jsonify({
                'success': False,
                'error': f"Compilation error: {compile_result.stderr}"
            }), 500
            
        logging.debug("C program compiled successfully")
        
        # Run with output capture and pass temperature as command line argument
        run_result = subprocess.run(['./mosquito_sim', str(data["temperature"]), str(data["days"])], 
                                   capture_output=True, text=True, check=False)
        
        if run_result.returncode != 0:
            logging.error(f"Runtime error: {run_result.stderr}")
            return jsonify({
                'success': False,
                'error': f"Runtime error: {run_result.stderr}"
            }), 500
            
        logging.debug(f"C program output: {run_result.stdout}")
        
        # Check if CSV files were created
        if not os.path.exists('global_stats.csv') or not os.path.exists('house_infected.csv'):
            logging.error("CSV files were not created by the simulation")
            return jsonify({
                'success': False,
                'error': "CSV files were not created by the simulation"
            }), 500
            
        # Read the CSV files and create plots
        global_stats = pd.read_csv('global_stats.csv')
        house_stats = pd.read_csv('house_infected.csv')
        
        logging.debug(f"CSV files read successfully. Global stats shape: {global_stats.shape}, House stats shape: {house_stats.shape}")
        
        # Check if the CSV files have data
        if global_stats.empty or house_stats.empty:
            logging.error("CSV files are empty")
            return jsonify({
                'success': False,
                'error': "Simulation produced empty data files"
            }), 500
        
        # Log some sample data to verify content
        logging.debug(f"Global stats sample:\n{global_stats.head()}")
        logging.debug(f"House stats sample:\n{house_stats.head()}")
        
        # Create a simpler direct data structure for Plotly.js
        # Population plot data
        pop_data = []
        
        # Add trace for each population type
        pop_data.append({
            'x': global_stats['day'].tolist(),
            'y': global_stats['S'].tolist(),
            'type': 'scatter',
            'mode': 'lines',
            'name': 'Susceptible Humans'
        })
        
        pop_data.append({
            'x': global_stats['day'].tolist(),
            'y': global_stats['I'].tolist(),
            'type': 'scatter',
            'mode': 'lines',
            'name': 'Infected Humans'
        })
        
        pop_data.append({
            'x': global_stats['day'].tolist(),
            'y': global_stats['R'].tolist(),
            'type': 'scatter',
            'mode': 'lines',
            'name': 'Recovered Humans'
        })
        
        pop_data.append({
            'x': global_stats['day'].tolist(),
            'y': global_stats['E_mos'].tolist(),
            'type': 'scatter',
            'mode': 'lines',
            'name': 'Exposed Mosquitoes'
        })
        
        pop_data.append({
            'x': global_stats['day'].tolist(),
            'y': global_stats['I_mos'].tolist(),
            'type': 'scatter',
            'mode': 'lines',
            'name': 'Infected Mosquitoes'
        })
        
        # Population plot layout
        pop_layout = {
            'title': 'Population Dynamics',
            'xaxis': {'title': 'Day'},
            'yaxis': {'title': 'Count'}
        }
        
        # House infection plot
        house_avg = house_stats.groupby('day')['infectedHumans'].mean().reset_index()
        
        house_data = [{
            'x': house_avg['day'].tolist(),
            'y': house_avg['infectedHumans'].tolist(),
            'type': 'scatter',
            'mode': 'lines',
            'name': 'Average Infected per House'
        }]
        
        house_layout = {
            'title': 'Average House Infection Rate',
            'xaxis': {'title': 'Day'},
            'yaxis': {'title': 'Average Infected Humans'}
        }
        
        logging.debug("Direct plot data created successfully")
        
        return jsonify({
            'success': True,
            'plots': {
                'population': {
                    'data': pop_data,
                    'layout': pop_layout
                },
                'infection': {
                    'data': house_data,
                    'layout': house_layout
                }
            }
        })
    
    except Exception as e:
        import traceback
        logging.error(f"Error: {str(e)}")
        logging.error(traceback.format_exc())
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

if __name__ == '__main__':
    app.run(debug=True) 