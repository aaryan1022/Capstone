#include <stdio.h>
#include <stdlib.h>
#include <math.h>
#include <time.h>

/* ----------------- Simulation Parameters ----------------- */

#define NUM_HOUSES        100
#define NUM_WORKPLACES    20
#define NUM_BREEDINGSITES 50

#define NUM_HUMANS        10000
#define NUM_MOSQUITOES    10000

#define DAYS              500
#define HOURS_PER_DAY     24

#define MAX_OCCUPANTS     200

#define DAILY_BITING_PROB 0.3
#define B_MOS_TO_HUMAN    0.2
#define C_HUMAN_TO_MOS    0.1
#define HUMAN_RECOVERY    (1.0/14.0)
#define MOSQ_MORTALITY    0.1
#define TAU_M             10
#define HUMAN_MORTALITY   0.0001

float TEMPERATURE = 25.0;
float HOURLY_BITING_PROB = DAILY_BITING_PROB / (double)HOURS_PER_DAY;
#define MOSQ_MOVE_CHANCE  0.1

// Add a variable to store the actual simulation days
int simulation_days = DAYS;

typedef enum {
    STATE_S,
    STATE_I,
    STATE_R
} HumanState;

typedef enum {
    MSTATE_S,
    MSTATE_E,
    MSTATE_I
} MosqState;

typedef struct {
    int occupantIDs[MAX_OCCUPANTS];
    int occupantCount;
} Node;

typedef struct {
    int        id;
    HumanState state;
    int        infectedDay;
    int        age;
    int        homeNet,  homeNode;
    int        workNet,  workNode;
    int        currentNet, currentNode;
} Human;

typedef struct {
    int       id;
    MosqState state;
    int       exposedDay;
    int       age;
    int       breedNet, breedNode;
    int       currentNet, currentNode;
} Mosquito;

/* Global arrays & structures */
Node houses[NUM_HOUSES];
Node workplaces[NUM_WORKPLACES];
Node breedingSites[NUM_BREEDINGSITES];

Human     humans[NUM_HUMANS];
Mosquito  mosquitoes[NUM_MOSQUITOES];

int day   = 0;
int hour  = 0;

/* We'll keep daily stats in arrays for in-memory use, then write them out after sim. */
int S_history[DAYS], I_history[DAYS], R_history[DAYS];
int E_history[DAYS], IM_history[DAYS], total_history[DAYS];

/* House-level time-series: house_infected_series[day][house_id].
   We'll store them in memory and then export to CSV. */
int house_infected_series[DAYS][NUM_HOUSES];

/* ----------------- Utility Functions ----------------- */

double randDouble() {
    return (double)rand() / (double)RAND_MAX;
}

Node* getNode(int netID, int nodeID) {
    switch(netID) {
        case 0: return &houses[nodeID];       /* Houses */
        case 1: return &workplaces[nodeID];   /* Workplaces */
        case 2: return &breedingSites[nodeID];/* BreedingSites */
        default: return NULL;
    }
}

void addAgent(Node *node, int agentID) {
    if (node->occupantCount < MAX_OCCUPANTS) {
        node->occupantIDs[node->occupantCount] = agentID;
        node->occupantCount++;
    }
}

void removeAgent(Node *node, int agentID) {
    int foundIndex = -1;
    for(int i=0; i<node->occupantCount; i++){
        if(node->occupantIDs[i] == agentID){
            foundIndex = i;
            break;
        }
    }
    if(foundIndex != -1){
        node->occupantIDs[foundIndex] = node->occupantIDs[node->occupantCount - 1];
        node->occupantCount--;
    }
}

void moveHuman(Human *h, int newNet, int newNode) {
    if(h->currentNet >= 0 && h->currentNode >= 0) {
        Node* oldNode = getNode(h->currentNet, h->currentNode);
        removeAgent(oldNode, h->id);
    }
    addAgent(getNode(newNet, newNode), h->id);

    h->currentNet  = newNet;
    h->currentNode = newNode;
}

void moveMosquito(Mosquito *m, int newNet, int newNode) {
    if(m->currentNet >= 0 && m->currentNode >= 0) {
        Node* oldNode = getNode(m->currentNet, m->currentNode);
        removeAgent(oldNode, m->id);
    }
    addAgent(getNode(newNet, newNode), m->id);

    m->currentNet  = newNet;
    m->currentNode = newNode;
}

/* ----------------- Initialization ----------------- */

void initNetworks();
void initPopulations();
void scheduleMovement();
void handleInfections();
void updateStates();
void recordStats();

void initNetworks() {
    for(int i=0; i<NUM_HOUSES; i++){ houses[i].occupantCount = 0; }
    for(int i=0; i<NUM_WORKPLACES; i++){ workplaces[i].occupantCount = 0; }
    for(int i=0; i<NUM_BREEDINGSITES; i++){ breedingSites[i].occupantCount = 0; }
}

void initPopulations() {
    /* Humans */
    for(int i=0; i<NUM_HUMANS; i++){
        humans[i].id           = i;
        humans[i].state        = STATE_S;
        humans[i].infectedDay  = -1;
        humans[i].age          = rand()%46 + 15;
        
        humans[i].homeNet  = 0; /* Houses */
        humans[i].homeNode = rand() % NUM_HOUSES;
        humans[i].workNet  = 1; /* Workplaces */
        humans[i].workNode = rand() % NUM_WORKPLACES;

        humans[i].currentNet   = -1;
        humans[i].currentNode  = -1;
        moveHuman(&humans[i], humans[i].homeNet, humans[i].homeNode);

        if(i < 10) {
            humans[i].state       = STATE_I;
            humans[i].infectedDay = 0;
        }
    }

    /* Mosquitoes */
    for(int i=0; i<NUM_MOSQUITOES; i++){
        mosquitoes[i].id         = 10000 + i;
        mosquitoes[i].state      = MSTATE_S;
        mosquitoes[i].exposedDay = -1;
        mosquitoes[i].age        = rand()%30 + 1;

        mosquitoes[i].breedNet  = 2; /* breedingSites */
        mosquitoes[i].breedNode = rand() % NUM_BREEDINGSITES;

        mosquitoes[i].currentNet  = -1;
        mosquitoes[i].currentNode = -1;
        moveMosquito(&mosquitoes[i], mosquitoes[i].breedNet, mosquitoes[i].breedNode);

        if(i < 100) {
            mosquitoes[i].state = MSTATE_I;
        }
    }
}

/* ----------------- Simulation Steps ----------------- */

void scheduleMovement() {
    int currentHour = hour % 24;

    /* Humans: move between home and work */
    for(int i=0; i<NUM_HUMANS; i++){
        Human *h = &humans[i];
        if(h->id < 0) continue; /* Dead human. */

        if(currentHour >= 8 && currentHour < 18) {
            if(!(h->currentNet == h->workNet && h->currentNode == h->workNode)) {
                moveHuman(h, h->workNet, h->workNode);
            }
        } else {
            if(!(h->currentNet == h->homeNet && h->currentNode == h->homeNode)) {
                moveHuman(h, h->homeNet, h->homeNode);
            }
        }
    }

    /* Mosquitoes: random movement */
    for(int i=0; i<NUM_MOSQUITOES; i++){
        Mosquito *m = &mosquitoes[i];
        if(m->id < 0) continue; /* Dead mosquito */

        if(randDouble() < MOSQ_MOVE_CHANCE) {
            int newNet, newNode;
            if(currentHour > 18 || currentHour < 6) {
                /* House or workplace at night */
                if(randDouble() < 0.5){
                    newNet  = 0;
                    newNode = rand() % NUM_HOUSES;
                } else {
                    newNet  = 1;
                    newNode = rand() % NUM_WORKPLACES;
                }
            } else {
                /* Breeding site in daytime */
                newNet  = 2;
                newNode = rand() % NUM_BREEDINGSITES;
            }
            moveMosquito(m, newNet, newNode);
        }
    }
}

void handleInfections() {
    /* Gather humans by location for quick lookup. We'll reuse static arrays each hour. */
    static int humansAtHouse[NUM_HOUSES][MAX_OCCUPANTS];
    static int countHouse[NUM_HOUSES];
    for(int i=0; i<NUM_HOUSES; i++){ countHouse[i] = 0; }

    static int humansAtWP[NUM_WORKPLACES][MAX_OCCUPANTS];
    static int countWP[NUM_WORKPLACES];
    for(int i=0; i<NUM_WORKPLACES; i++){ countWP[i] = 0; }

    static int humansAtBS[NUM_BREEDINGSITES][MAX_OCCUPANTS];
    static int countBS[NUM_BREEDINGSITES];
    for(int i=0; i<NUM_BREEDINGSITES; i++){ countBS[i] = 0; }

    /* Place humans in relevant array */
    for(int i=0; i<NUM_HUMANS; i++){
        if(humans[i].id < 0) continue; /* Dead */
        int netID  = humans[i].currentNet;
        int nodeID = humans[i].currentNode;
        if(netID == 0){
            int idx = countHouse[nodeID]++;
            humansAtHouse[nodeID][idx] = i;
        } else if(netID == 1){
            int idx = countWP[nodeID]++;
            humansAtWP[nodeID][idx] = i;
        } else if(netID == 2){
            int idx = countBS[nodeID]++;
            humansAtBS[nodeID][idx] = i;
        }
    }

    for(int i=0; i<NUM_MOSQUITOES; i++){
        Mosquito *m = &mosquitoes[i];
        if(m->id < 0) continue;

        int netID  = m->currentNet;
        int nodeID = m->currentNode;

        int localCount = 0;
        int *localHumans;

        if(netID == 0){
            localCount   = countHouse[nodeID];
            localHumans  = humansAtHouse[nodeID];
        } else if(netID == 1){
            localCount   = countWP[nodeID];
            localHumans  = humansAtWP[nodeID];
        } else if(netID == 2){
            localCount   = countBS[nodeID];
            localHumans  = humansAtBS[nodeID];
        }
        if(localCount <= 0) continue;

        if(m->state == MSTATE_I){
            /* Infect humans with prob HOURLY_BITING_PROB, then B_MOS_TO_HUMAN */
            if(randDouble() < HOURLY_BITING_PROB){
                for(int h=0; h<localCount; h++){
                    Human *H = &humans[ localHumans[h] ];
                    if(H->state == STATE_S && H->id >= 0){
                        if(randDouble() < B_MOS_TO_HUMAN){
                            H->state       = STATE_I;
                            H->infectedDay = day;
                        }
                    }
                }
            }
        } else if(m->state == MSTATE_S){
            /* Maybe get infected from local infected humans */
            int infectedHere = 0;
            for(int h=0; h<localCount; h++){
                if(humans[ localHumans[h] ].state == STATE_I)
                    infectedHere++;
            }
            if(infectedHere > 0){
                if(randDouble() < HOURLY_BITING_PROB){
                    if(randDouble() < C_HUMAN_TO_MOS){
                        m->state      = MSTATE_E;
                        m->exposedDay = day;
                    }
                }
            }
        }
    }
}

void updateStates() {
    /* Humans */
    for(int i=0; i<NUM_HUMANS; i++){
        Human *h = &humans[i];
        if(h->id < 0) continue; /* Already dead */

        if(h->state == STATE_I){
            if((day - h->infectedDay) >= 14){
                if(randDouble() < HUMAN_RECOVERY){
                    h->state = STATE_R;
                }
            }
        }

        /* Mortality */
        if(randDouble() < HUMAN_MORTALITY){
            Node *node = getNode(h->currentNet, h->currentNode);
            removeAgent(node, h->id);
            h->id = -1; /* mark dead */
        }
    }

    /* Mosquitoes */
    for(int i=0; i<NUM_MOSQUITOES; i++){
        Mosquito *m = &mosquitoes[i];
        if(m->id < 0) continue;

        if(m->state == MSTATE_E){
            if((day - m->exposedDay) >= TAU_M){
                m->state = MSTATE_I;
            }
        }

        /* Mosquito mortality */
        if(randDouble() < MOSQ_MORTALITY){
            Node *node = getNode(m->currentNet, m->currentNode);
            removeAgent(node, m->id);
            m->id = -1;
        }
    }

    /* Repopulate mosquitoes if below 5000 alive */
    int aliveCount = 0;
    for(int i=0; i<NUM_MOSQUITOES; i++){
        if(mosquitoes[i].id >= 0) aliveCount++;
    }
    int needed = 5000 - aliveCount;
    for(int i=0; i<needed; i++){
        for(int j=0; j<NUM_MOSQUITOES; j++){
            if(mosquitoes[j].id < 0){
                /* Respawn here */
                int newID = 10000 + j;
                mosquitoes[j].id         = newID;
                mosquitoes[j].state      = MSTATE_S;
                mosquitoes[j].exposedDay = -1;
                mosquitoes[j].age        = rand()%30 + 1;

                int bID = rand() % NUM_BREEDINGSITES;
                moveMosquito(&mosquitoes[j], 2, bID);
                break;
            }
        }
    }
}

/* Record daily stats in arrays for later CSV output */
void recordStats() {
    int S=0, I=0, R=0;
    int E_m=0, I_m=0;

    for(int i=0; i<NUM_HUMANS; i++){
        if(humans[i].id < 0) continue;
        switch(humans[i].state){
            case STATE_S: S++; break;
            case STATE_I: I++; break;
            case STATE_R: R++; break;
        }
    }
    int totalH = S + I + R;

    for(int i=0; i<NUM_MOSQUITOES; i++){
        if(mosquitoes[i].id < 0) continue;
        if(mosquitoes[i].state == MSTATE_E) E_m++;
        else if(mosquitoes[i].state == MSTATE_I) I_m++;
    }

    S_history[day]   = S;
    I_history[day]   = I;
    R_history[day]   = R;
    E_history[day]   = E_m;
    IM_history[day]  = I_m;
    total_history[day] = totalH;

    /* House-level: count infected per house */
    for(int h=0; h<NUM_HOUSES; h++){
        int infectedCount = 0;
        for(int occ=0; occ<houses[h].occupantCount; occ++){
            int agID = houses[h].occupantIDs[occ];
            if(agID >= 0 && agID < NUM_HUMANS){  /* is a human */
                if(humans[agID].id >= 0 && humans[agID].state == STATE_I) {
                    infectedCount++;
                }
            }
        }
        house_infected_series[day][h] = infectedCount;
    }
}

void updateTemperatureEffects() {
    float temp_factor = 1.0;
    
    if (TEMPERATURE < 18.0) {
        temp_factor = 0.5;
    } else if (TEMPERATURE > 30.0) {
        temp_factor = 0.8;
    } else {
        temp_factor = 1.0 + (TEMPERATURE - 22.0) * 0.05;
        if (temp_factor > 1.3) temp_factor = 1.3;
    }
    
    HOURLY_BITING_PROB = (DAILY_BITING_PROB * temp_factor) / (float)HOURS_PER_DAY;
    
    printf("Temperature: %.1f°C, Factor: %.2f, Hourly Biting: %.5f\n", 
           TEMPERATURE, temp_factor, HOURLY_BITING_PROB);
}

int main(int argc, char *argv[]) {
    srand((unsigned) time(0));
    
    // Check if temperature was provided as command line argument
    if (argc > 1) {
        TEMPERATURE = atof(argv[1]);
        printf("Using temperature: %.1f°C\n", TEMPERATURE);
    }
    
    // Check if days was provided as command line argument
    if (argc > 2) {
        simulation_days = atoi(argv[2]);
        if (simulation_days > DAYS) simulation_days = DAYS;
        printf("Using simulation days: %d\n", simulation_days);
    }
    
    // Update parameters based on temperature
    updateTemperatureEffects();

    initNetworks();
    initPopulations();

    /* Run simulation */
    for(day=0; day<simulation_days; day++){
        for(hour=day*HOURS_PER_DAY; hour<(day+1)*HOURS_PER_DAY; hour++){
            scheduleMovement();
            handleInfections();
        }
        updateStates();
        recordStats();
    }

    /* ----------------- Write CSV Files ----------------- */

    /* 1) Global stats to global_stats.csv */
    FILE *fglobal = fopen("global_stats.csv", "w");
    if(fglobal){
        fprintf(fglobal, "day,S,I,R,E_mos,I_mos,totalHumans\n");
        for(int d=0; d<simulation_days; d++){
            fprintf(fglobal, "%d,%d,%d,%d,%d,%d,%d\n",
                d,
                S_history[d],
                I_history[d],
                R_history[d],
                E_history[d],
                IM_history[d],
                total_history[d]);
        }
        fclose(fglobal);
        printf("global_stats.csv written!\n");
    } else {
        printf("Could not open global_stats.csv for writing.\n");
    }

    /* 2) House-level infected stats to house_infected.csv */
    FILE *fhouses = fopen("house_infected.csv", "w");
    if(fhouses){
        fprintf(fhouses, "day,houseID,infectedHumans\n");
        for(int d=0; d<simulation_days; d++){
            for(int h=0; h<NUM_HOUSES; h++){
                fprintf(fhouses, "%d,%d,%d\n",
                    d, h, house_infected_series[d][h]);
            }
        }
        fclose(fhouses);
        printf("house_infected.csv written!\n");
    } else {
        printf("Could not open house_infected.csv for writing.\n");
    }

    printf("Simulation complete.\n");
    return 0;
}
