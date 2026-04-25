const { execSync } = require('child_process');

console.log('================================================');
console.log('   THAI SCAM DETECTOR: PERFORMANCE BENCHMARK    ');
console.log('      JavaScript (Node.js) vs Python 3          ');
console.log('================================================\n');

function runCommand(command) {
    try {
        console.log(`Executing: ${command}...`);
        const output = execSync(command, { encoding: 'utf8' });
        console.log(output);
        return output;
    } catch (error) {
        console.error(`Error executing ${command}:`, error.message);
        return null;
    }
}

// 1. Run JavaScript Benchmark
const jsOutput = runCommand('node test_optimize.js');

console.log('------------------------------------------------');

// 2. Run Python Benchmark
// Trying 'python' first, then 'py' if it fails (common on Windows)
let pyOutput = runCommand('python test_optimize.py');
if (!pyOutput) {
    pyOutput = runCommand('py test_optimize.py');
}

console.log('================================================');
console.log('               BENCHMARK COMPLETE               ');
console.log('================================================');

if (jsOutput && pyOutput) {
    // Basic extraction of time from output for summary
    const jsTimeMatch = jsOutput.match(/Average Time per iteration: ([\d.]+) ms/);
    const pyTimeMatch = pyOutput.match(/Average Time per iteration: ([\d.]+) ms/);

    if (jsTimeMatch && pyTimeMatch) {
        const jsTime = parseFloat(jsTimeMatch[1]);
        const pyTime = parseFloat(pyTimeMatch[1]);
        const ratio = (pyTime / jsTime).toFixed(1);

        console.log('\nFINAL VERDICT:');
        console.log(`- JavaScript: ${jsTime.toFixed(2)} ms/avg`);
        console.log(`- Python:     ${pyTime.toFixed(2)} ms/avg`);
        console.log(`\nNode.js is approximately ${ratio}x faster for this DSP task.`);
    }
}
