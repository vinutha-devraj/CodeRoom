function Output({ output }) {
  return (
    <div className="output-wrapper">
      <div className="output-header">
        <span>📤 Output</span>
      </div>
      <pre className="output-content">
        {output || 'Run your code to see output here...'}
      </pre>
    </div>
  );
}

export default Output;
