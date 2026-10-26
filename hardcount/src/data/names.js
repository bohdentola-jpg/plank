// Name pools for everything the game generates: players, coaches, reporters,
// recruiters, hometowns, and the parts high schools are made from. Plain data
// plus a few rng helpers (rng = makeRng(seed) from core/util.js) — no DOM, no
// three.js, so the headless sim and tools can import it.
//
// The player pools lean the way a mid-2000s American football roster did:
// Southern and Black first names, Texas and California Latino families,
// Samoan and Tongan linemen, sons of Nigerian immigrants, Midwest farm kids,
// Cajun and Polish and Italian surnames from the old football towns.

// ------------------------------------------------------------------ players

// Heritage groups. FIRST and LAST (below) are the flat pools roster.js picks
// from; playerName() keeps first and last names from the same family most of
// the time, which reads more like a real roster ('Sione Mauga', 'Emeka
// Okonkwo', 'Luis Trevino'), and crosses over now and then.
const F_COMMON = [
  'Marcus', 'Tyrell', 'Jake', 'DeShawn', 'Cody', 'Andre', 'Brandon', 'Malik', 'Tyler', 'Jamal', 'Ryan', 'Darius',
  'Kyle', 'Terrence', 'Austin', 'Devin', 'Jordan', 'Trey', 'Cameron', 'Isaiah', 'Logan', 'Xavier', 'Chase', 'Dante',
  'Garrett', 'Quentin', 'Brett', 'Jalen', 'Colby', 'Reggie', 'Hunter', 'Lamar', 'Dalton', 'Cedric', 'Wyatt', 'Desmond',
  'Nate', 'Corey', 'Tavon', 'Shane', 'Elijah', 'Rashad', 'Kevin', 'Bo', 'Javon', 'Clay', 'Antonio', 'Derek',
  'Ike', 'Keenan', 'Rocco', 'Vince', 'Omar', 'Calvin', 'Rodney', 'Earl', 'Myles', 'Grady', 'Thad', 'Zeke',
  'Daquan', 'Mason', 'Trent', 'Kendrick', 'Justin', 'Travis', 'Chad', 'Dustin', 'Zach', 'Josh', 'Shawn', 'Trevor',
  'Casey', 'Colt', 'Tanner', 'Bryce', 'Lance', 'Terrell', 'Jeremy', 'Nathan', 'Aaron', 'Adam', 'Sean', 'Patrick',
  'Blake', 'Skyler', 'Michael', 'Chris', 'Matt', 'Brian', 'Eric', 'Jason', 'Mike', 'Tony', 'Steve', 'Greg',
  'Danny', 'Joey', 'Bobby', 'Jimmy', 'Billy', 'Johnny', 'Tommy', 'Ricky', 'Randy', 'Robbie', 'Jared', 'Jeff',
  'Kris', 'Brent', 'Brady', 'Cole', 'Drew', 'Grant', 'Heath', 'Jace', 'Kurt', 'Luke', 'Mitch', 'Nick',
  'Owen', 'Pete', 'Reid', 'Seth', 'Todd', 'Wade', 'Wes', 'Zane', 'Brock', 'Clint', 'Dane', 'Ty',
  'Jody', 'Kirby', 'Lyle', 'Rhett', 'Beau', 'Cale', 'Gage', 'Jett', 'Kade', 'Trace', 'Tate', 'Ross',
  'Alexander', 'Benjamin', 'Christian', 'Daniel', 'David', 'Gabriel', 'Jacob', 'James', 'John', 'Joseph', 'Joshua', 'Matthew',
  'Noah', 'Samuel', 'Thomas', 'William', 'Anthony', 'Andrew', 'Caleb', 'Ethan', 'Evan', 'Jackson', 'Jonathan', 'Kenny',
  'Lee', 'Paul', 'Quinn', 'Riley', 'Scott', 'Spencer', 'Stephen', 'Troy', 'Vaughn', 'Warren', 'Bennett', 'Carson',
  'Dakota', 'Denver', 'Easton', 'Jaxon', 'Kellen', 'Kody', 'Landry', 'Maverick', 'Peyton', 'Ridge', 'Ryder', 'Stetson',
];
const F_BLACK = [
  'Jaylen', 'Jamar', 'Marquise', 'Keyshawn', 'Ladarius', 'Tremaine', 'Demarco', 'Darnell', 'Dwayne', 'Tyrone', 'Terrance', 'Reginald',
  'Cornelius', 'Jermaine', 'Dominique', 'Antwan', 'Rasheed', 'Kareem', 'Jabari', 'Khalil', 'Darrius', 'Deion', 'Tavaris', 'Montae',
  'Quincy', 'Roderick', 'Marvin', 'Curtis', 'Willie', 'Fred', 'Leroy', 'Otis', 'Clarence', 'Alvin', 'Rufus', 'Darryl',
  'Jarvis', 'Kordell', 'Lavar', 'Marquez', 'Tavian', 'Ahmad', 'Hakeem', 'Bryant', 'Dorian', 'Jerome', 'Lorenzo', 'Maurice',
  'Rashard', 'Shaun', 'Stephon', 'Tarik', 'Vernon', 'Xzavier', 'Zavier', 'Deandre', 'Demetrius', 'Devonte', 'Donte', 'Jaquan',
  'Jarell', 'Keon', 'Kenyatta', 'Lavell', 'Marshawn', 'Nnamdi', 'Odell', 'Raheem', 'Santonio', 'Sheldon', 'Torrey', 'Travon',
  'Trayvon', 'Tywan', 'Antoine', 'Cortez', 'Dameon', 'Darrell', 'Delvin', 'Derrius', 'Desean', 'Dewayne', 'Ervin', 'Fabian',
  'Garrison', 'Isaac', 'Jamarcus', 'Jamel', 'Jevon', 'Kentrell', 'Lamont', 'Lonnie', 'Marlon', 'Montrell', 'Nathaniel', 'Rayshawn',
  'Ronnie', 'Sammie', 'Tyreek', 'Tremayne', 'Vontae', 'Wendell', 'Booker', 'Champ', 'Ellis', 'Hines', 'Jerrell', 'Kirk',
];
const F_LATINO = [
  'Luis', 'Mateo', 'Tomás', 'Carlos', 'Miguel', 'Alejandro', 'Diego', 'Javier', 'Jesús', 'Ramón', 'Rafael', 'Eduardo',
  'Fernando', 'Hector', 'Ignacio', 'Joaquín', 'Julio', 'Manny', 'Marco', 'Mario', 'Nico', 'Pablo', 'Rey', 'Ruben',
  'Santiago', 'Sergio', 'Victor', 'Adrian', 'Andres', 'Armando', 'Arturo', 'Emilio', 'Esteban', 'Gilberto', 'Gustavo', 'Orlando',
];
const F_POLY = [
  'Sione', 'Kai', 'Tevita', 'Manti', 'Junior', 'Malakai', 'Siaosi', 'Toa', 'Ofa', 'Keoni', 'Kekoa', 'Makana',
  'Pita', 'Viliami', 'Fili', 'Losi', 'Iosefa', 'Tua', 'Kawika', 'Noa', 'Afa', 'Lolo', 'Paea', 'Taniela',
];
const F_AFRICAN = [
  'Emeka', 'Chidi', 'Obinna', 'Uche', 'Kelechi', 'Chukwuma', 'Ifeanyi', 'Tunde', 'Ade', 'Femi', 'Kwame', 'Kofi',
];
const F_EURO = [
  'Dmitri', 'Anton', 'Bogdan', 'Lukas', 'Stefan', 'Viktor', 'Gunnar', 'Lars', 'Sven', 'Anders', 'Nils', 'Dominic',
  'Vito', 'Angelo', 'Gino', 'Sal', 'Enzo', 'Liam', 'Connor', 'Declan', 'Brendan', 'Seamus', 'Padraig', 'Finn',
  'Hank', 'Gus', 'Walt', 'Ernie', 'Buck', 'Duke', 'Gene', 'Lou', 'Moose', 'Sonny', 'Butch', 'Chip',
];
const F_ASIAN = [
  'Duc', 'Minh', 'Hiro', 'Kenji', 'Jin', 'Hyun', 'Arjun', 'Ravi', 'Sami', 'Tariq', 'Yusuf', 'Ibrahim',
];

// surnames common across the country, and the Southern/Black football families
const L_COMMON = [
  'Johnson', 'Williams', 'Smith', 'Jones', 'Brown', 'Davis', 'Miller', 'Wilson', 'Moore', 'Taylor', 'Anderson', 'Thomas',
  'Jackson', 'White', 'Harris', 'Martin', 'Thompson', 'Robinson', 'Clark', 'Lewis', 'Walker', 'Allen', 'Young', 'King',
  'Wright', 'Scott', 'Green', 'Baker', 'Adams', 'Nelson', 'Hill', 'Campbell', 'Mitchell', 'Roberts', 'Carter', 'Phillips',
  'Evans', 'Turner', 'Parker', 'Collins', 'Edwards', 'Stewart', 'Morris', 'Murphy', 'Cook', 'Rogers', 'Morgan', 'Cooper',
  'Peterson', 'Bailey', 'Reed', 'Kelly', 'Howard', 'Ward', 'Cox', 'Richardson', 'Wood', 'Watson', 'Bennett', 'Gray',
  'James', 'Hughes', 'Price', 'Myers', 'Long', 'Foster', 'Butler', 'Barnes', 'Fisher', 'Henderson', 'Bryant', 'Ford',
  'Simmons', 'Graham', 'Hamilton', 'Wallace', 'Woods', 'West', 'Jordan', 'Owens', 'Reynolds', 'Ellis', 'Harrison', 'Gibson',
  'McDonald', 'Marshall', 'Wells', 'Hunter', 'Freeman', 'Webb', 'Tucker', 'Porter', 'Hunt', 'Mason', 'Hicks', 'Black',
  'Palmer', 'Robertson', 'Daniels', 'Mills', 'Grant', 'Knight', 'Ferguson', 'Stone', 'Hawkins', 'Dunn', 'Perkins', 'Hudson',
  'Spencer', 'Gardner', 'Stephens', 'Payne', 'Pierce', 'Berry', 'Matthews', 'Arnold', 'Wagner', 'Willis', 'Ray', 'Watkins',
  'Olson', 'Carroll', 'Duncan', 'Snyder', 'Hart', 'Cunningham', 'Bradley', 'Lane', 'Andrews', 'Harper', 'Fox', 'Riley',
  'Armstrong', 'Carpenter', 'Weaver', 'Greene', 'Lawrence', 'Elliott', 'Chavez', 'Sims', 'Austin', 'Peters', 'Kelley', 'Franklin',
  'Lawson', 'Fields', 'Ryan', 'Schmidt', 'Carr', 'Castro', 'Williamson', 'Moss', 'Sherman', 'Dawson', 'Lambert', 'Hale',
];
const L_SOUTH = [
  'Washington', 'Hayes', 'Brooks', 'Holloway', 'Sanders', 'Pruitt', 'Gaines', 'Mercer', 'Whitfield', 'Crenshaw', 'Bishop', 'Thornton',
  'Mayfield', 'Odom', 'Banks', 'Kincaid', 'Barrow', 'Coleman', 'Huckabee', 'Jefferson', 'Strickland', 'Bledsoe', 'Pittman', 'Grayson',
  'Ferrell', 'Abernathy', 'Dunlap', 'Booker', 'Hargrove', 'Ivory', 'Lattimore', 'Quarles', 'Sutton', 'Vance', 'Wilcox', 'Yates',
  'Ballard', 'Cobb', 'Dempsey', 'Easley', 'Gentry', 'Horn', 'Jenkins', 'Kirby', 'Lyle', 'Mabry', 'Orr', 'Pace',
  'Rhodes', 'Sharpe', 'Tate', 'Upshaw', 'Ware', 'Youngblood', 'Archer', 'Beasley', 'Calloway', 'Dukes', 'Boudreaux', 'Thibodeaux',
  'Fontenot', 'Guidry', 'LeBlanc', 'Broussard', 'Hebert', 'Landry', 'Arceneaux', 'Champagne', 'Breaux', 'Comeaux', 'Pickens', 'Mosley',
  'Tolliver', 'Dorsey', 'Battle', 'McCray', 'Truesdale', 'Pettaway', 'Peoples', 'Witherspoon', 'Rountree', 'Shuler', 'Spurlock', 'Darby',
  'Langham', 'Merriweather', 'Holcomb', 'Greer', 'Haynes', 'Pope', 'Ingram', 'Royster', 'Toomer', 'Lockett', 'McNair', 'Culbreath',
  'Stallings', 'Swanson', 'Bilecki', 'Fairley', 'Mixon', 'Whitlock', 'Gholston', 'Funchess', 'Spikes', 'Starks', 'Pepperman', 'Ogletree',
  'Kilgore', 'Sapper', 'Dunbar', 'Kitchens', 'Lockhart', 'Hairston', 'Mangum', 'Pegues', 'Seals', 'Burrell', 'Tillman', 'Brinkley',
  'Whitaker', 'Galloway', 'Stokes', 'Ridley', 'Pollard', 'Mathis', 'Coker', 'Burnett', 'Caldwell', 'Granger', 'Jessup', 'Larkin',
  'Briggs', 'Hutchins', 'Boone', 'Tatum', 'Reeves', 'McCoy', 'Dillard', 'Blevins', 'Crowder', 'Faulkner', 'Gaither', 'Hollins',
  'Kearse', 'Lofton', 'Munford', 'Nance', 'Overton', 'Pressley', 'Redd', 'Sweeney', 'Thigpen', 'Vickers',
];
const L_LATINO = [
  'Reyes', 'Delgado', 'Vasquez', 'Ruiz', 'Castillo', 'Zamora', 'Nunez', 'Rodriguez', 'Garcia', 'Martinez', 'Hernandez', 'Lopez',
  'Gonzalez', 'Perez', 'Sanchez', 'Ramirez', 'Torres', 'Flores', 'Rivera', 'Gomez', 'Diaz', 'Morales', 'Ortiz', 'Gutierrez',
  'Mendoza', 'Ruelas', 'Salazar', 'Cardenas', 'Escobar', 'Fuentes', 'Ibarra', 'Medina', 'Navarro', 'Ochoa', 'Padilla', 'Quintero',
  'Robles', 'Saldana', 'Trevino', 'Valenzuela', 'Villarreal', 'Zavala', 'Guerrero',
];
const L_POLY = [
  'Tuiasosopo', 'Faleolo', 'Mauga', 'Fifita', 'Taamu', 'Pouono', 'Savea', 'Fua', 'Tuipulotu', 'Kaufusi', 'Mateialona', 'Lealaimatafao',
  'Tuitama', 'Sopoaga', 'Vainuku', 'Paepule', 'Kemoeatu', 'Manumaleuna', 'Fonoti', 'Siliga', 'Tafuna', 'Unga', 'Kalani', 'Kahale',
  'Akana', 'Moniz',
];
const L_AFRICAN = [
  'Okafor', 'Okonkwo', 'Adeyemi', 'Nwosu', 'Okoye', 'Eze', 'Obi', 'Ogunleye', 'Umeh', 'Adebayo', 'Mensah', 'Asante',
  'Owusu', 'Ekwueme', 'Okeke', 'Uzomah', 'Nnadi', 'Odighizuwa', 'Ogbah',
];
// Rust Belt and Plains: Polish, German, Scandinavian, Italian, Irish, Greek, Slavic
const L_EURO = [
  'Kowalski', 'McAllister', 'Fitzgerald', 'Lindqvist', 'Petrakis', 'Moreau', 'Sorensen', 'Novak', 'Wojcik', 'Kaminski', 'Zielinski', 'Lewandowski',
  'Bartosik', 'Jablonski', 'Gradkowski', 'Kolbeck', 'Hoffman', 'Schultz', 'Becker', 'Krueger', 'Vogel', 'Lindgren', 'Johansson', 'Halvorsen',
  'Bergstrom', 'Nygaard', 'Kowalczyk', 'Russo', 'DeLuca', 'Esposito', 'Marino', 'Romano', 'Bianchi', 'Costa', 'Lombardi', 'Mancini',
  'Terranova', 'Gramlich', 'Caruso', 'O\'Brien', 'O\'Neal', 'McCarthy', 'Sullivan', 'Callahan', 'Flanagan', 'Gallagher', 'Brennan', 'Doyle',
  'Keane', 'Nolan', 'Quinlan', 'Byrne', 'Hennessy', 'Donovan', 'Fogarty', 'Christensen', 'Rasmussen', 'Pedersen', 'Dvorak', 'Horvath',
  'Kovac', 'Petrov', 'Volkov', 'Popescu', 'Stavros', 'Papadopoulos', 'Kostas',
];
const L_ASIAN = [
  'Nakamura', 'Nguyen', 'Tran', 'Le', 'Pham', 'Kim', 'Park', 'Tanaka', 'Yamamoto', 'Patel', 'Shah', 'Haddad',
  'Nassar',
];

/** Heritage groups: weight = share of generated players, first/last pools. */
export const NAME_GROUPS = [
  { id: 'black', weight: 0.42, first: [F_BLACK, F_BLACK, F_COMMON], last: [L_COMMON, L_SOUTH] },
  { id: 'common', weight: 0.34, first: [F_COMMON, F_COMMON, F_EURO], last: [L_COMMON, L_SOUTH, L_EURO] },
  { id: 'latino', weight: 0.1, first: [F_LATINO, F_LATINO, F_COMMON], last: [L_LATINO] },
  { id: 'poly', weight: 0.05, first: [F_POLY, F_POLY, F_COMMON], last: [L_POLY] },
  { id: 'african', weight: 0.04, first: [F_AFRICAN, F_AFRICAN, F_BLACK], last: [L_AFRICAN] },
  { id: 'euro', weight: 0.03, first: [F_EURO, F_COMMON], last: [L_EURO] },
  { id: 'asian', weight: 0.02, first: [F_ASIAN, F_COMMON], last: [L_ASIAN] },
];

const uniq = (lists) => [...new Set(lists.flat())];
export const FIRST = uniq([F_COMMON, F_BLACK, F_LATINO, F_POLY, F_AFRICAN, F_EURO, F_ASIAN]);
export const LAST = uniq([L_COMMON, L_SOUTH, L_LATINO, L_POLY, L_AFRICAN, L_EURO, L_ASIAN]);

// ------------------------------------------------------------------ coaches

// Head coaches and coordinators: names that sound like a whistle and a
// headset — older, plainer, a few nicknames that stuck.
export const COACH_FIRST = [
  'Bill', 'Gary', 'Dick', 'Jim', 'Bob', 'Tom', 'Mike', 'Joe', 'Dan', 'Dave', 'Don', 'Ron', 'Rich', 'Larry', 'Dennis',
  'Jerry', 'Terry', 'Steve', 'Frank', 'Ray', 'Hal', 'Marv', 'Lou', 'Mack', 'Hank', 'Chuck', 'Butch', 'Buddy', 'Sonny',
  'Bobby', 'Johnny', 'Jimmy', 'Wade', 'Bud', 'Chet', 'Marty', 'Norm', 'Herb', 'Tony', 'Lonnie', 'Jon', 'Mel', 'Ted',
  'Wally', 'Glen', 'Gene', 'Earl', 'Fred', 'Al', 'Ken', 'Rex', 'Pat', 'Phil', 'Walt', 'Grady', 'Barry', 'Les', 'Mark',
  'Rodney', 'Curtis', 'Leon', 'Clarence', 'Willie', 'Otis', 'Reggie', 'Ernie', 'Vern', 'Lyle', 'Dwight', 'Wendell',
];
export const COACH_LAST = [
  'Halloran', 'Kessler', 'Brandt', 'Dorsett', 'Pruitt', 'Mahaffey', 'Stroud', 'Pickett', 'Wendtland', 'Gruber', 'Lindell', 'Hollister',
  'Crowley', 'Riordan', 'Bannon', 'McKinney', 'Sabatino', 'Bowers', 'Tolbert', 'Kinnear', 'Vermeer', 'Shanley', 'Cowan', 'Dittmer',
  'Holtzman', 'Parcell', 'Coghlan', 'Fasching', 'Haskell', 'Marucci', 'Reeves', 'Schottmiller', 'Fisher', 'Dunaway', 'Green', 'Edwards',
  'Callahan', 'Gibbons', 'Billings', 'Jarrell', 'Mora', 'Capshaw', 'Fox', 'Turner', 'Shell', 'Rhodes', 'Phillips', 'Hennig',
  'Dobbs', 'Garrity', 'Hartnett', 'Kowalczyk', 'Lombard', 'Mancuso', 'Nagle', 'Oberle', 'Pagano', 'Quist', 'Rademacher', 'Steinkamp',
  'Teague', 'Underwood', 'Vandermeer', 'Wofford', 'Yarbrough', 'Ziegler', 'Boyd', 'Calhoun', 'Dupree', 'Faircloth', 'Grimes', 'Hightower',
];
export const COACH_NICKNAMES = ['Bear', 'Bum', 'Red', 'Shug', 'Pop', 'Tiger', 'Moose', 'Bulldog', 'Iron Mike', 'Doc', 'Skip', 'Cotton', 'Dutch', 'Slick', 'Hoss'];

// Sideline reporters, studio hosts, beat writers, radio voices.
export const REPORTER_FIRST = [
  'Pam', 'Suzy', 'Andrea', 'Michele', 'Lesley', 'Jill', 'Bonnie', 'Holly', 'Tracy', 'Melissa', 'Erin', 'Lisa', 'Wendy', 'Dana',
  'Rachel', 'Kristen', 'Laura', 'Tina', 'Heather', 'Jenna', 'Monica', 'Pat', 'Chris', 'Dan', 'Jim', 'Al', 'Brent', 'Bob',
  'Vern', 'Dick', 'Kevin', 'Greg', 'Ian', 'Marv', 'Gus', 'Kenny', 'Stu', 'Rich', 'Mark', 'Chip', 'Bryant', 'Lynn',
  'Shelley', 'Robin', 'Jay', 'Craig', 'Howie', 'Terry', 'Cris', 'Boomer', 'Trey', 'Ahmad', 'Steve', 'Joe', 'Wayne', 'Keith',
];
export const REPORTER_LAST = [
  'Dalrymple', 'Kinkade', 'Ostrander', 'Prescott', 'Whitcomb', 'Harlan', 'Beauchamp', 'Ashby', 'Vandergriff', 'Lindahl', 'Albrecht', 'Thayer',
  'Merriman', 'Castellano', 'Fairbanks', 'Goodwin', 'Hawley', 'Ingalls', 'Jarrett', 'Kendall', 'Lockwood', 'Montgomery', 'Norwood', 'Pemberton',
  'Ramsey', 'Sterling', 'Tremblay', 'Upton', 'Valentine', 'Wainwright', 'Abbott', 'Brewster', 'Carmichael', 'Delaney', 'Ellsworth', 'Fairchild',
  'Gallo', 'Hendricks', 'Irving', 'Jacoby', 'Kilmer', 'Lattimer', 'Madsen', 'Nicholls', 'Oakes', 'Pruett', 'Quayle', 'Rourke',
];
// fictional outlets for bylines and chyrons
export const OUTLETS = [
  'The Sevens Network', 'SNN SportsNight', 'Gridiron Weekly', 'The Halcyon Ledger', 'Motor City Free Press', 'Houston Chronicle-Star',
  'Wasatch Tribune', 'KTXR Channel 9', 'WFBN 1050 AM', 'The Prep Report', 'Rivals Insider', 'National Recruiting Wire',
  'Friday Night Live (local cable)', 'The Daily Bugle-Herald', 'Sunday Ticket Talk', 'Overtime Magazine', 'The Blue Chip Bulletin', 'Varsity Nation',
];

// College assistants and recruiting coordinators: younger, Southern-leaning,
// the guy in the polo at your kitchen table.
export const RECRUITER_FIRST = [
  'Trey', 'Brent', 'Chad', 'Jeremy', 'Lance', 'Clay', 'Kirby', 'Dub', 'Tad', 'Lane', 'Kirk', 'Mack', 'Cody', 'Scott',
  'Brian', 'Todd', 'Shane', 'Darrell', 'Tim', 'Bryan', 'Kevin', 'Reggie', 'Tony', 'Corey', 'Jay', 'Ed', 'Mario', 'Butch',
  'Will', 'Ron', 'Rusty', 'Major', 'Sonny', 'Skip', 'Hugh', 'Jeff', 'Marcus', 'Billy', 'Derek', 'Mike', 'Josh', 'Wes',
];
export const RECRUITER_LAST = [
  'Ogletree', 'Muscatel', 'Pruitt', 'Venable', 'Kiffmeyer', 'Swindell', 'Mullinax', 'Odom', 'Sumrall', 'Applegate', 'Stoope', 'Doolittle',
  'Bielski', 'Leachman', 'Petrillo', 'Bowdoin', 'Tubbs', 'Fullerton', 'Franceschi', 'Hatcher', 'Sloan', 'Bobo', 'Chisholm', 'Hawkins',
  'Cutright', 'Patterson', 'Brennaman', 'Cagle', 'Dew', 'Ezell', 'Fagan', 'Gatlin', 'Hux', 'Ivey', 'Jinks', 'Knox',
  'Ledbetter', 'Marchbanks', 'Nix', 'Overstreet', 'Puckett', 'Ragsdale', 'Satterfield', 'Tidwell', 'Upchurch', 'Vines', 'Whisenant', 'Yeager',
];

// ------------------------------------------------------------------ places

// Real American football towns — where the recruits come from.
export const HOMETOWNS = [
  { city: 'Valdosta', state: 'GA' }, { city: 'Massillon', state: 'OH' }, { city: 'Odessa', state: 'TX' }, { city: 'Allen', state: 'TX' },
  { city: 'Katy', state: 'TX' }, { city: 'Southlake', state: 'TX' }, { city: 'Euless', state: 'TX' }, { city: 'Lufkin', state: 'TX' },
  { city: 'Aledo', state: 'TX' }, { city: 'Beaumont', state: 'TX' }, { city: 'Converse', state: 'TX' }, { city: 'Tyler', state: 'TX' },
  { city: 'Abilene', state: 'TX' }, { city: 'Amarillo', state: 'TX' }, { city: 'Lubbock', state: 'TX' }, { city: 'Waco', state: 'TX' },
  { city: 'Temple', state: 'TX' }, { city: 'Midland', state: 'TX' }, { city: 'Galveston', state: 'TX' }, { city: 'El Paso', state: 'TX' },
  { city: 'Belle Glade', state: 'FL' }, { city: 'Pahokee', state: 'FL' }, { city: 'Bradenton', state: 'FL' }, { city: 'Miami', state: 'FL' },
  { city: 'Fort Lauderdale', state: 'FL' }, { city: 'Jacksonville', state: 'FL' }, { city: 'Tampa', state: 'FL' }, { city: 'Lakeland', state: 'FL' },
  { city: 'Gainesville', state: 'FL' }, { city: 'Pensacola', state: 'FL' }, { city: 'Daytona Beach', state: 'FL' }, { city: 'Ocala', state: 'FL' },
  { city: 'Hoover', state: 'AL' }, { city: 'Mobile', state: 'AL' }, { city: 'Tuscaloosa', state: 'AL' }, { city: 'Dothan', state: 'AL' },
  { city: 'Montgomery', state: 'AL' }, { city: 'Florence', state: 'AL' }, { city: 'Hattiesburg', state: 'MS' }, { city: 'Tupelo', state: 'MS' },
  { city: 'Starkville', state: 'MS' }, { city: 'Meridian', state: 'MS' }, { city: 'Greenwood', state: 'MS' }, { city: 'Monroe', state: 'LA' },
  { city: 'Shreveport', state: 'LA' }, { city: 'Baton Rouge', state: 'LA' }, { city: 'Lafayette', state: 'LA' }, { city: 'Lake Charles', state: 'LA' },
  { city: 'Thibodaux', state: 'LA' }, { city: 'Opelousas', state: 'LA' }, { city: 'Athens', state: 'GA' }, { city: 'Macon', state: 'GA' },
  { city: 'Savannah', state: 'GA' }, { city: 'Columbus', state: 'GA' }, { city: 'Albany', state: 'GA' }, { city: 'Rome', state: 'GA' },
  { city: 'Steubenville', state: 'OH' }, { city: 'Canton', state: 'OH' }, { city: 'Youngstown', state: 'OH' }, { city: 'Cincinnati', state: 'OH' },
  { city: 'Toledo', state: 'OH' }, { city: 'Akron', state: 'OH' }, { city: 'Aliquippa', state: 'PA' }, { city: 'McKeesport', state: 'PA' },
  { city: 'Erie', state: 'PA' }, { city: 'Scranton', state: 'PA' }, { city: 'Altoona', state: 'PA' }, { city: 'Beaver Falls', state: 'PA' },
  { city: 'Jersey City', state: 'NJ' }, { city: 'Paterson', state: 'NJ' }, { city: 'Camden', state: 'NJ' }, { city: 'Trenton', state: 'NJ' },
  { city: 'Brockton', state: 'MA' }, { city: 'Worcester', state: 'MA' }, { city: 'Buffalo', state: 'NY' }, { city: 'Syracuse', state: 'NY' },
  { city: 'Baltimore', state: 'MD' }, { city: 'Hagerstown', state: 'MD' }, { city: 'Richmond', state: 'VA' }, { city: 'Norfolk', state: 'VA' },
  { city: 'Hampton', state: 'VA' }, { city: 'Roanoke', state: 'VA' }, { city: 'Charlotte', state: 'NC' }, { city: 'Durham', state: 'NC' },
  { city: 'Fayetteville', state: 'NC' }, { city: 'Wilmington', state: 'NC' }, { city: 'Greenville', state: 'SC' }, { city: 'Rock Hill', state: 'SC' },
  { city: 'Orangeburg', state: 'SC' }, { city: 'Spartanburg', state: 'SC' }, { city: 'Knoxville', state: 'TN' }, { city: 'Memphis', state: 'TN' },
  { city: 'Nashville', state: 'TN' }, { city: 'Chattanooga', state: 'TN' }, { city: 'Murfreesboro', state: 'TN' }, { city: 'Louisville', state: 'KY' },
  { city: 'Bowling Green', state: 'KY' }, { city: 'Paducah', state: 'KY' }, { city: 'Little Rock', state: 'AR' }, { city: 'Pine Bluff', state: 'AR' },
  { city: 'Texarkana', state: 'AR' }, { city: 'Tulsa', state: 'OK' }, { city: 'Norman', state: 'OK' }, { city: 'Lawton', state: 'OK' },
  { city: 'Muskogee', state: 'OK' }, { city: 'Wichita', state: 'KS' }, { city: 'Topeka', state: 'KS' }, { city: 'Omaha', state: 'NE' },
  { city: 'Lincoln', state: 'NE' }, { city: 'Grand Island', state: 'NE' }, { city: 'Des Moines', state: 'IA' }, { city: 'Cedar Rapids', state: 'IA' },
  { city: 'Sioux City', state: 'IA' }, { city: 'Sioux Falls', state: 'SD' }, { city: 'Fargo', state: 'ND' }, { city: 'Duluth', state: 'MN' },
  { city: 'Eden Prairie', state: 'MN' }, { city: 'Green Bay', state: 'WI' }, { city: 'Kenosha', state: 'WI' }, { city: 'Racine', state: 'WI' },
  { city: 'Flint', state: 'MI' }, { city: 'Saginaw', state: 'MI' }, { city: 'Detroit', state: 'MI' }, { city: 'Muskegon', state: 'MI' },
  { city: 'Gary', state: 'IN' }, { city: 'Fort Wayne', state: 'IN' }, { city: 'Evansville', state: 'IN' }, { city: 'Indianapolis', state: 'IN' },
  { city: 'East St. Louis', state: 'IL' }, { city: 'Joliet', state: 'IL' }, { city: 'Peoria', state: 'IL' }, { city: 'Chicago', state: 'IL' },
  { city: 'St. Louis', state: 'MO' }, { city: 'Kansas City', state: 'MO' }, { city: 'Springfield', state: 'MO' }, { city: 'Denver', state: 'CO' },
  { city: 'Pueblo', state: 'CO' }, { city: 'Colorado Springs', state: 'CO' }, { city: 'Salt Lake City', state: 'UT' }, { city: 'Provo', state: 'UT' },
  { city: 'Ogden', state: 'UT' }, { city: 'Boise', state: 'ID' }, { city: 'Billings', state: 'MT' }, { city: 'Casper', state: 'WY' },
  { city: 'Albuquerque', state: 'NM' }, { city: 'Las Cruces', state: 'NM' }, { city: 'Phoenix', state: 'AZ' }, { city: 'Tucson', state: 'AZ' },
  { city: 'Mesa', state: 'AZ' }, { city: 'Las Vegas', state: 'NV' }, { city: 'Reno', state: 'NV' }, { city: 'Long Beach', state: 'CA' },
  { city: 'Compton', state: 'CA' }, { city: 'Fresno', state: 'CA' }, { city: 'Bakersfield', state: 'CA' }, { city: 'Oakland', state: 'CA' },
  { city: 'Sacramento', state: 'CA' }, { city: 'San Diego', state: 'CA' }, { city: 'Mission Viejo', state: 'CA' }, { city: 'Concord', state: 'CA' },
  { city: 'Tacoma', state: 'WA' }, { city: 'Spokane', state: 'WA' }, { city: 'Seattle', state: 'WA' }, { city: 'Portland', state: 'OR' },
  { city: 'Eugene', state: 'OR' }, { city: 'Honolulu', state: 'HI' }, { city: 'Kahuku', state: 'HI' }, { city: 'Anchorage', state: 'AK' },
  { city: 'Laie', state: 'HI' }, { city: 'Carson', state: 'CA' }, { city: 'Euclid', state: 'OH' }, { city: 'Bessemer', state: 'AL' },
];

export const STATE_NAMES = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware',
  FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky',
  LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri',
  MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York',
  NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island',
  SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington',
  WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming', DC: 'District of Columbia',
};

// ------------------------------------------------------------------ high schools

// Fictional small towns are built from a front and a back: 'Cedar' + ' Falls',
// 'Mill' + 'brook'. Backs that start with a space are separate words.
export const TOWN_FRONT = [
  'Cedar', 'Mill', 'Oak', 'Pine', 'Stone', 'Clear', 'Red', 'Fair', 'Spring', 'Maple', 'River', 'Lake', 'Elm', 'Ash',
  'Willow', 'Iron', 'Copper', 'Silver', 'Gold', 'Black', 'White', 'Green', 'Rock', 'Sand', 'Bear', 'Fox', 'Deer', 'Eagle',
  'Hawk', 'Brook', 'Glen', 'Ridge', 'Wolf', 'Buffalo', 'Beaver', 'Coal', 'Salt', 'Shady', 'Sweet', 'Pleasant', 'Prairie', 'Harmon',
  'Crest', 'Hollow', 'Cotton', 'Magnolia', 'Laurel', 'Hickory', 'Walnut', 'Chestnut', 'Cypress', 'Sycamore', 'Bluff', 'Mesa', 'Granite', 'Flint',
];
export const TOWN_BACK = [
  'ville', 'ton', 'field', 'brook', 'wood', 'ford', 'dale', ' Ridge', ' Creek', ' Falls', ' Springs', ' Valley', ' Hill', ' Point',
  ' Grove', ' Heights', ' City', 'burg', 'port', ' Harbor', ' Bend', ' Junction', ' Plains', ' Lake', ' Bluff', 'mont', 'land', 'view',
  'haven', 'worth', 'stead', ' Hollow', ' Station', ' Flats', ' Mills', ' Crossing', 'ton Park', ' Gap', ' Fork', ' Shoals',
];
// Ready-made town names that feel lived in.
export const TOWNS = [
  'Harmon', 'Dillard', 'Westbury', 'Ashford', 'Bellmont', 'Carver', 'Danforth', 'Elkhart Lake', 'Fulton', 'Garnett', 'Holbrook', 'Ingram',
  'Jasper', 'Kearney', 'Lowell', 'Marlow', 'Newcomb', 'Orland', 'Pruett', 'Quinlan', 'Rockdale', 'Sterling', 'Tolliver', 'Union Grove',
  'Vernon', 'Waverly', 'Yoakum', 'Zebulon', 'Bayou Vista', 'Permian Flats', 'Copper Creek', 'Stony Point', 'Prairie View', 'Iron City', 'Oak Valley', 'Millbrook',
  'Cedar Ridge', 'Eastlake', 'Crestwood', 'Fairmont', 'Maple Heights', 'Bluffton', 'Riverdale', 'Westfield', 'Lincoln', 'Summit', 'Harlan', 'Cumberland Gap',
];
// '{town}' is replaced with the town, '{name}' with a famous-surname pick.
export const SCHOOL_FORMS = [
  '{town} High', '{town} High', '{town} High', '{town} Central', 'North {town}', 'South {town}', 'East {town}', 'West {town}',
  '{town} Regional', '{town} Consolidated', '{town} County', '{town} Senior High', '{town} Academy', '{town} Christian',
  '{name} High', '{name} Memorial', 'St. {saint}', 'Bishop {name}',
];
export const SCHOOL_SURNAMES = ['Lincoln', 'Jefferson', 'Roosevelt', 'Washington', 'Kennedy', 'Madison', 'Monroe', 'Jackson', 'Grant', 'Lee', 'Douglass', 'Carver', 'Edison', 'Franklin', 'Hamilton', 'Marshall', 'Wilson', 'Truman', 'Eisenhower', 'Hoover'];
export const SAINTS = ['Joseph', 'Thomas Aquinas', 'Xavier', 'Ignatius', 'Michael', 'Patrick', 'Augustine', 'Pius', 'Francis', 'John Bosco', 'Brendan', 'Edward'];

// High-school mascots and the emblem (gfx/logos.js) that draws them.
export const MASCOTS = [
  { name: 'Panthers', emblem: 'paw' }, { name: 'Wildcats', emblem: 'paw' }, { name: 'Tigers', emblem: 'paw' }, { name: 'Cougars', emblem: 'paw' },
  { name: 'Bobcats', emblem: 'paw' }, { name: 'Lions', emblem: 'paw' }, { name: 'Eagles', emblem: 'eagle' }, { name: 'Falcons', emblem: 'eagle' },
  { name: 'Hawks', emblem: 'eagle' }, { name: 'Warhawks', emblem: 'eagle' }, { name: 'Bulldogs', emblem: 'bulldog' }, { name: 'Bears', emblem: 'bear' },
  { name: 'Grizzlies', emblem: 'bear' }, { name: 'Wolves', emblem: 'wolf' }, { name: 'Huskies', emblem: 'wolf' }, { name: 'Coyotes', emblem: 'wolf' },
  { name: 'Rams', emblem: 'ram' }, { name: 'Mustangs', emblem: 'horse' }, { name: 'Broncos', emblem: 'horseshoe' }, { name: 'Colts', emblem: 'horseshoe' },
  { name: 'Spartans', emblem: 'spartan' }, { name: 'Trojans', emblem: 'spartan' }, { name: 'Titans', emblem: 'spartan' }, { name: 'Warriors', emblem: 'spartan' },
  { name: 'Knights', emblem: 'knight' }, { name: 'Crusaders', emblem: 'shield' }, { name: 'Vikings', emblem: 'viking' }, { name: 'Raiders', emblem: 'swords' },
  { name: 'Pirates', emblem: 'swords' }, { name: 'Buccaneers', emblem: 'swords' }, { name: 'Miners', emblem: 'pickaxe' }, { name: 'Prospectors', emblem: 'pickaxe' },
  { name: 'Lumberjacks', emblem: 'axe' }, { name: 'Rockets', emblem: 'comet' }, { name: 'Comets', emblem: 'comet' }, { name: 'Chargers', emblem: 'bolt' },
  { name: 'Lightning', emblem: 'bolt' }, { name: 'Storm', emblem: 'bolt' }, { name: 'Tornadoes', emblem: 'tornado' }, { name: 'Cyclones', emblem: 'tornado' },
  { name: 'Hurricanes', emblem: 'hurricane' }, { name: 'Blazers', emblem: 'flame' }, { name: 'Flames', emblem: 'flame' }, { name: 'Stars', emblem: 'star' },
  { name: 'Owls', emblem: 'owl' }, { name: 'Rattlers', emblem: 'rattlesnake' }, { name: 'Longhorns', emblem: 'longhorn' }, { name: 'Steers', emblem: 'longhorn' },
  { name: 'Buffaloes', emblem: 'bison' }, { name: 'Bison', emblem: 'bison' }, { name: 'Ironmen', emblem: 'anvil' }, { name: 'Blacksmiths', emblem: 'anvil' },
  { name: 'Mariners', emblem: 'anchor' }, { name: 'Sailors', emblem: 'wheel' }, { name: 'Monarchs', emblem: 'crown' }, { name: 'Royals', emblem: 'crown' },
  { name: 'Mountaineers', emblem: 'mountain' }, { name: 'Highlanders', emblem: 'mountain' }, { name: 'Suns', emblem: 'sun' }, { name: 'Torch', emblem: 'torch' },
  { name: 'Breakers', emblem: 'wave' }, { name: 'Engineers', emblem: 'gear' }, { name: 'Roughnecks', emblem: 'derrick' }, { name: 'Drillers', emblem: 'derrick' },
  { name: 'Pioneers', emblem: 'wagonwheel' }, { name: 'Settlers', emblem: 'wagonwheel' }, { name: 'Timberwolves', emblem: 'wolf' }, { name: 'Pines', emblem: 'pine' },
  { name: 'Cardinals', emblem: 'letter' }, { name: 'Patriots', emblem: 'star' }, { name: 'Golden Bears', emblem: 'bear' }, { name: 'Hornets', emblem: 'letter' },
];

// ------------------------------------------------------------------ helpers

/** A player name {first, last} from one heritage group (now and then
 *  crossed with another). Optional `used` Set keeps a roster unique. */
export function playerName(rng, used) {
  const groupPick = () => {
    let r = rng();
    for (const g of NAME_GROUPS) { r -= g.weight; if (r <= 0) return g; }
    return NAME_GROUPS[0];
  };
  for (let i = 0; i < 40; i++) {
    const g = groupPick();
    const fg = rng() < 0.12 ? groupPick() : g; // a mixed family
    const first = rng.pick(rng.pick(fg.first));
    const last = rng.pick(rng.pick(g.last));
    const k = first + ' ' + last;
    if (!used || !used.has(k)) { used?.add(k); return { first, last }; }
  }
  return { first: rng.pick(FIRST), last: rng.pick(LAST) + ' Jr.' };
}

/** A head coach: { first, last, nickname|null }. */
export function coachName(rng) {
  return {
    first: rng.pick(COACH_FIRST),
    last: rng.pick(COACH_LAST),
    nickname: rng() < 0.12 ? rng.pick(COACH_NICKNAMES) : null,
  };
}

/** A reporter with an outlet: { first, last, outlet }. */
export function reporterName(rng) {
  return { first: rng.pick(REPORTER_FIRST), last: rng.pick(REPORTER_LAST), outlet: rng.pick(OUTLETS) };
}

/** A college recruiter: { first, last }. */
export function recruiterName(rng) {
  return { first: rng.pick(RECRUITER_FIRST), last: rng.pick(RECRUITER_LAST) };
}

/** A hometown { city, state }. */
export function hometown(rng) {
  return rng.pick(HOMETOWNS);
}

/** A fictional small-town name. */
export function townName(rng) {
  if (rng() < 0.3) return rng.pick(TOWNS);
  const front = rng.pick(TOWN_FRONT);
  let back = rng.pick(TOWN_BACK);
  // 'Brookbrook', 'Ridge Ridge' and friends
  if (back.trim().toLowerCase().startsWith(front.toLowerCase().slice(0, 4))) back = ' Springs';
  return front + back;
}

/** A school name built around a town ('North Cedar Falls', 'St. Xavier'). */
export function schoolName(rng, town) {
  const form = rng.pick(SCHOOL_FORMS);
  return form
    .replace('{town}', town)
    .replace('{name}', rng.pick(SCHOOL_SURNAMES))
    .replace('{saint}', rng.pick(SAINTS));
}
