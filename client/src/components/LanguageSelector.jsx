import { languages } from '../utils/languages';

function LanguageSelector({ language, onChange }) {
  return (
    <select 
      className="language-selector"
      value={language}
      onChange={(e) => onChange(e.target.value)}
    >
      {languages.map(lang => (
        <option key={lang.id} value={lang.id}>
          {lang.name}
        </option>
      ))}
    </select>
  );
}

export default LanguageSelector;
