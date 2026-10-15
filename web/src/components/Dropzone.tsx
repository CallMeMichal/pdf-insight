import { useRef, useState, type DragEvent, type Ref } from 'react';
import { MAX_FILE_SIZE_MB } from '@pdf-insight/shared';

interface DropzoneProps {
  onFiles: (files: File[]) => void;
  /** Pole wyboru pliku — rodzic przenosi na nie fokus po „Analizuj kolejny plik”. */
  ref?: Ref<HTMLInputElement>;
}

function hasFiles(event: DragEvent) {
  return event.dataTransfer.types.includes('Files');
}

/**
 * Pole wyboru Dokumentu: przeciągnięcie pliku albo wybór z okna systemowego. Przyjmuje wszystko, co
 * użytkownik poda — walidację (typ, rozmiar, liczba plików) robi rodzic, żeby pokazać komunikat.
 */
export function Dropzone({ onFiles, ref }: DropzoneProps) {
  const [dragging, setDragging] = useState(false);
  // `dragenter`/`dragleave` przychodzą też z elementów potomnych, a Safari nie podaje
  // `relatedTarget` — licznik wejść mówi, czy kursor nadal jest nad polem.
  const dragDepth = useRef(0);

  return (
    <div className="upload">
      <label
        className={dragging ? 'dropzone dragging' : 'dropzone'}
        onDragEnter={(event) => {
          if (!hasFiles(event)) return;
          dragDepth.current += 1;
          setDragging(true);
        }}
        onDragOver={(event) => {
          if (!hasFiles(event)) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = 'copy';
        }}
        onDragLeave={(event) => {
          if (!hasFiles(event)) return;
          dragDepth.current = Math.max(0, dragDepth.current - 1);
          if (dragDepth.current === 0) setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          dragDepth.current = 0;
          setDragging(false);
          onFiles(Array.from(event.dataTransfer.files));
        }}
      >
        <input
          ref={ref}
          className="visually-hidden"
          type="file"
          accept="application/pdf,.pdf"
          aria-describedby="upload-hint upload-privacy"
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            // Pusta lista to anulowane okno wyboru — nie ma czego zgłaszać.
            if (files.length > 0) onFiles(files);
            event.target.value = '';
          }}
        />
        <span className="dropzone-title">Przeciągnij tutaj plik PDF</span>
        <span>
          lub <span className="dropzone-button">wybierz plik</span>
        </span>
        <span id="upload-hint" className="dropzone-hint">
          Jeden PDF z warstwą tekstową, do {MAX_FILE_SIZE_MB} MB
        </span>
      </label>
      <p id="upload-privacy" className="privacy-note">
        <strong>Uwaga:</strong> tekst dokumentu zostanie wysłany do Google Gemini. Demo korzysta z
        darmowego planu, więc Google może wykorzystać przesłane treści do ulepszania swoich modeli.
        Nie wgrywaj dokumentów poufnych.
      </p>
    </div>
  );
}
