'use strict';

const fs = require('fs');
const readline = require('readline');

const FILE_NAME = 'courses.txt';

class Course {
  constructor(code, title, units) {
    this.code  = Course.normalizeCode(code);
    this.title = Course.normalizeTitle(title);
    this.units = Course.normalizeUnits(units);
  }

  static normalizeCode(code) {
    const value = String(code ?? '').trim().toUpperCase();
    if (value.length === 0) throw new Error('Course code cannot be empty.');
    return value;
  }

  static normalizeTitle(title) {
    const value = String(title ?? '').trim();
    if (value.length === 0) throw new Error('Course title cannot be empty.');
    return value;
  }

  static normalizeUnits(units) {
    const value = Number(units);
    if (!Number.isInteger(value) || value < 1 || value > 12)
      throw new Error('Units must be a whole number between 1 and 12.');
    return value;
  }

  toFileString() {
    return `${this.code}|${this.title}|${this.units}`;
  }

  static fromFileString(line) {
    const parts = line.split('|');
    if (parts.length !== 3) throw new Error(`Malformed record: "${line}"`);
    return new Course(parts[0], parts[1], parts[2].trim());
  }

  toString() {
    return `${this.code.padEnd(10)} ${this.title.padEnd(32)} ${String(this.units).padStart(5)}`;
  }
}

class DuplicateCourseError extends Error {
  constructor(message) {
    super(message);
    this.name = 'DuplicateCourseError';
  }
}

class CourseManager {
  constructor() {
    this.courses = [];
  }

  addCourse(course) {
    if (this.findByCode(course.code))
      throw new DuplicateCourseError(
        `Course ${course.code} already exists in the list.`);
    this.courses.push(course);
  }

  findByCode(code) {
    const target = String(code).trim().toUpperCase();
    for (const c of this.courses)
      if (c.code === target) return c;
    return null;
  }

  searchByCodeRecursive(code, index = 0) {
    if (index >= this.courses.length) return null;
    if (this.courses[index].code === String(code).trim().toUpperCase())
      return this.courses[index];
    return this.searchByCodeRecursive(code, index + 1);
  }

  totalUnitsRecursive(index = 0) {
    if (index >= this.courses.length) return 0;
    return this.courses[index].units + this.totalUnitsRecursive(index + 1);
  }

  saveToFile(fileName) {
    const content = this.courses.map(c => c.toFileString()).join('\n');
    fs.writeFileSync(fileName, content + (content ? '\n' : ''), 'utf8');
  }

  loadFromFile(fileName) {
    if (!fs.existsSync(fileName))
      throw new Error(`File '${fileName}' was not found.`);

    const raw   = fs.readFileSync(fileName, 'utf8');
    const lines = raw.split(/\r?\n/);
    const loaded = [];
    let skipped = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed === '') continue;
      try {
        loaded.push(Course.fromFileString(trimmed));
      } catch {
        skipped++;
      }
    }

    this.courses = loaded;
    return skipped;
  }

  get size() { return this.courses.length; }
  isEmpty()  { return this.courses.length === 0; }
}

const rl  = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (prompt) => new Promise(resolve => rl.question(prompt, resolve));

async function askIntInRange(prompt, min, max) {
  while (true) {
    const answer = (await ask(prompt)).trim();
    const n = Number(answer);
    if (Number.isInteger(n) && n >= min && n <= max) return n;
    console.log(`  ! Please enter a whole number between ${min} and ${max}.`);
  }
}

async function askNonEmpty(prompt) {
  while (true) {
    const answer = (await ask(prompt)).trim();
    if (answer.length > 0) return answer;
    console.log('  ! This field cannot be empty.');
  }
}

function printMenu() {
  console.log('\n----------------- MENU -----------------');
  console.log(' 1. Add Course');
  console.log(' 2. View All Courses');
  console.log(' 3. Search Course by Code');
  console.log(' 4. Compute Total Units');
  console.log(' 5. Save to File');
  console.log(' 6. Load from File');
  console.log(' 7. Exit Program');
  console.log('----------------------------------------');
}

function printTableHeader() {
  console.log('---------------------------------------------------------');
  console.log(`${'CODE'.padEnd(10)} ${'COURSE TITLE'.padEnd(32)} ${'UNITS'.padStart(5)}`);
  console.log('---------------------------------------------------------');
}

async function addCourse(manager) {
  console.log('\n--- Add New Course ---');
  try {
    const code  = await askNonEmpty('Course code  (e.g. COS201): ');
    const title = await askNonEmpty('Course title              : ');
    const units = await askIntInRange('Units (1 - 12)            : ', 1, 12);

    const course = new Course(code, title, units);
    manager.addCourse(course);
    console.log(`  >> Course added successfully: ${course.code}`);
  } catch (err) {
    if (err instanceof DuplicateCourseError) console.log(`  ! ${err.message}`);
    else console.log(`  ! Input error: ${err.message}`);
  }
}

function viewAllCourses(manager) {
  console.log('\n--- All Registered Courses ---');
  if (manager.isEmpty()) {
    console.log('  (No courses recorded yet.)');
    return;
  }
  printTableHeader();
  for (const c of manager.courses) console.log(c.toString());
  console.log('---------------------------------------------------------');
  console.log(`  Total courses: ${manager.size}   |   Total units: ${manager.totalUnitsRecursive()}`);
}

async function searchCourse(manager) {
  console.log('\n--- Search Course by Code ---');
  if (manager.isEmpty()) {
    console.log('  (No courses recorded yet.)');
    return;
  }
  const code  = await askNonEmpty('Enter course code: ');
  const found = manager.searchByCodeRecursive(code);

  if (!found) {
    console.log(`  ! No course found with code ${code.trim().toUpperCase()}`);
  } else {
    console.log('  >> Course found:');
    printTableHeader();
    console.log(found.toString());
  }
}

function computeTotalUnits(manager) {
  console.log('\n--- Total Credit Units ---');
  if (manager.isEmpty()) {
    console.log('  Total units = 0 (no courses recorded).');
    return;
  }
  console.log(`  Courses registered : ${manager.size}`);
  console.log(`  TOTAL CREDIT UNITS : ${manager.totalUnitsRecursive()}`);
}

function saveCourses(manager) {
  console.log('\n--- Save to File ---');
  try {
    manager.saveToFile(FILE_NAME);
    console.log(`  >> ${manager.size} course(s) saved to '${FILE_NAME}'.`);
  } catch (err) {
    console.log(`  ! Could not save file: ${err.message}`);
  }
}

function loadCourses(manager) {
  console.log('\n--- Load from File ---');
  try {
    const skipped = manager.loadFromFile(FILE_NAME);
    console.log(`  >> ${manager.size} course(s) loaded from '${FILE_NAME}'.`);
    if (skipped > 0) console.log(`  ! ${skipped} invalid record(s) were skipped.`);
  } catch (err) {
    console.log(`  ! ${err.message} Save some courses first.`);
  }
}

async function main() {
  const manager = new CourseManager();

  console.log('=================================================');
  console.log('     STUDENT COURSE MANAGEMENT SYSTEM');
  console.log('=================================================');

  let choice;
  do {
    printMenu();
    choice = await askIntInRange('Select an option (1-7): ', 1, 7);

    switch (choice) {
      case 1: await addCourse(manager);     break;
      case 2: viewAllCourses(manager);      break;
      case 3: await searchCourse(manager);  break;
      case 4: computeTotalUnits(manager);   break;
      case 5: saveCourses(manager);         break;
      case 6: loadCourses(manager);         break;
      case 7: console.log('\nGoodbye! Remember to save your work.'); break;
    }
  } while (choice !== 7);

  rl.close();
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  rl.close();
  process.exit(1);
});