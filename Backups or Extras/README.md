# Malaria Transmission Simulator

An interactive web-based simulator for modeling malaria transmission dynamics in a population.

## Overview

This application provides a user-friendly interface to run malaria transmission simulations with customizable parameters. It visualizes the results using interactive graphs to help understand how malaria spreads through a population under different conditions.

## Features

- **Interactive Parameter Setting**: Adjust human population, mosquito population, number of houses, temperature, and simulation duration.
- **Preset Scenarios**: Quick-start with predefined scenarios like tropical climate, temperate climate, urban setting, and rural setting.
- **Real-time Visualization**: View simulation results through interactive graphs showing:
  - Global transmission dynamics (SIR model for humans and EI model for mosquitoes)
  - House-level infection patterns
- **Summary Statistics**: Get key metrics like peak infection, total infected, and transmission rates.
- **Responsive Design**: Works on desktop and mobile devices.

## Technical Details

The simulator consists of:

1. **Frontend**: HTML, CSS, and JavaScript with Plotly.js for data visualization
2. **Backend**: Node.js server with Express
3. **Simulation Engine**: C program that implements the malaria transmission model

The simulation uses a compartmental model with the following components:
- **S**: Susceptible humans
- **I**: Infected humans
- **R**: Recovered humans with temporary immunity
- **E_m**: Exposed mosquitoes (incubating the parasite)
- **I_m**: Infectious mosquitoes

## Installation

### Prerequisites
- Node.js (v12 or higher)
- GCC compiler for the C simulation code

### Setup
1. Clone this repository
2. Install dependencies:
   ```
   npm install
   ```
3. Make sure your C code is in the root directory as `code.c`
4. Start the server:
   ```
   npm start
   ```
5. Access the application at `http://localhost:3000`

## Usage

1. Set simulation parameters using the sliders or input fields
2. Click "Run Simulation" to execute the model
3. View the results in the graphs below
4. Switch between different views using the tabs
5. Use the toggle buttons to show/hide different data series

## Parameter Explanation

- **Human Population**: Total number of humans in the simulation area
- **Mosquito Population**: Total number of mosquitoes in the simulation area
- **Number of Houses**: Affects population density and spatial distribution
- **Temperature**: Influences mosquito biting rate and mortality
- **Simulation Days**: Duration of the simulation

## How It Works

1. The user sets parameters through the web interface
2. The frontend sends these parameters to the backend
3. The backend modifies the C code with the new parameters
4. The C program is compiled and executed
5. The resulting CSV files are read and sent back to the frontend
6. The frontend visualizes the data using Plotly.js

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- The simulation model is based on established epidemiological principles for vector-borne diseases
- Visualization uses the Plotly.js library 