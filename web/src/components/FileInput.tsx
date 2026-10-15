interface FileInputProps {
  disabled: boolean;
  onFile: (file: File) => void;
}

export function FileInput({ disabled, onFile }: FileInputProps) {
  return (
    <label>
      Wybierz plik PDF:{' '}
      <input
        type="file"
        accept="application/pdf,.pdf"
        disabled={disabled}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(file);
          event.target.value = '';
        }}
      />
    </label>
  );
}
