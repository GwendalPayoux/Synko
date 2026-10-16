import { useEffect, useRef, useState } from 'react';
import { FileText, Upload, Download, History, FolderOpen } from 'lucide-react';
import { api, type Document, type Version, type Project } from './domain';
import { Empty, Modal } from './components';
const size = (n: number) =>
  n < 1024
    ? n + ' o'
    : n < 1048576
      ? (n / 1024).toFixed(1) + ' Ko'
      : (n / 1048576).toFixed(1) + ' Mo';
export function Documents({
  project,
  canWrite,
  onError,
}: {
  project: Project;
  canWrite: boolean;
  onError: (s: string) => void;
}) {
  const [docs, setDocs] = useState<Document[]>([]),
    [versions, setVersions] = useState<Version[]>([]),
    [selected, setSelected] = useState<Document | null>(null),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [query, setQuery] = useState('');
  const input = useRef<HTMLInputElement>(null),
    [target, setTarget] = useState<Document | null>(null);
  const base = `/projects/${project.id}/documents`;
  async function load() {
    setDocs(await api<Document[]>(base));
  }
  useEffect(() => {
    setLoading(true);
    load()
      .catch((e) => onError(e.message))
      .finally(() => setLoading(false));
  }, [project.id]);
  async function upload(file?: File) {
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      onError('Le fichier dépasse la limite de 20 Mo.');
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(
        '/api' +
          base +
          (target ? `/${target.id}/versions` : `?name=${encodeURIComponent(file.name)}`),
        { method: 'POST', body: file, headers: { 'Content-Type': 'application/octet-stream' } },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      await load();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }
  async function history(doc: Document) {
    try {
      setVersions(await api<Version[]>(`${base}/${doc.id}/versions`));
      setSelected(doc);
    } catch (e) {
      onError((e as Error).message);
    }
  }
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h3>
            <FolderOpen size={18} />
            Documents du projet
          </h3>
          <span className="muted">Fichiers privés · versions conservées · 20 Mo maximum</span>
        </div>
        {canWrite && (
          <button
            className="primary"
            disabled={busy}
            onClick={() => {
              setTarget(null);
              input.current?.click();
            }}
          >
            <Upload size={16} />
            {busy ? 'Import en cours…' : 'Importer un fichier'}
          </button>
        )}
        <input ref={input} type="file" hidden onChange={(e) => upload(e.target.files?.[0])} />
      </div>
      <div className="document-search">
        <input
          aria-label="Rechercher un document"
          placeholder="Rechercher un document…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {loading ? (
        <p className="loading">Chargement des documents…</p>
      ) : !docs.length ? (
        <Empty
          title="Une place pour chaque livrable"
          description="Importez vos premiers fichiers. Chaque nouvelle version restera accessible dans l’historique."
          icon={<FileText />}
        />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Document</th>
                <th>Version</th>
                <th>Taille</th>
                <th>Mis à jour</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {docs
                .filter((d) => d.name.toLowerCase().includes(query.toLowerCase()))
                .map((d) => (
                  <tr key={d.id}>
                    <td>
                      <span className="file-name">
                        <FileText size={20} />
                        {d.name}
                      </span>
                    </td>
                    <td>
                      <span className="version-badge">v{d.version}</span>
                    </td>
                    <td>{size(d.size)}</td>
                    <td>{new Date(d.updated_at).toLocaleDateString('fr-FR')}</td>
                    <td>
                      <div className="row-actions">
                        <a
                          className="icon-button"
                          aria-label={'Télécharger ' + d.name}
                          href={'/api' + base + `/${d.id}/versions/${d.version_id}`}
                        >
                          <Download size={17} />
                        </a>
                        <button
                          className="icon-button"
                          aria-label={'Historique de ' + d.name}
                          onClick={() => history(d)}
                        >
                          <History size={17} />
                        </button>
                        {canWrite && (
                          <button
                            className="icon-button"
                            disabled={busy}
                            aria-label={'Nouvelle version de ' + d.name}
                            onClick={() => {
                              setTarget(d);
                              input.current?.click();
                            }}
                          >
                            <Upload size={17} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
      {selected && (
        <Modal title={'Versions · ' + selected.name} onClose={() => setSelected(null)}>
          <div className="version-list">
            {versions.map((v) => (
              <article key={v.id}>
                <div>
                  <strong>Version {v.version}</strong>
                  <p>
                    {new Date(v.created_at).toLocaleString('fr-FR')} · {size(v.size)}
                  </p>
                  <small title={v.sha256}>SHA-256 : {v.sha256.slice(0, 20)}…</small>
                </div>
                <a className="secondary" href={'/api' + base + `/${selected.id}/versions/${v.id}`}>
                  <Download size={16} />
                  Télécharger
                </a>
              </article>
            ))}
          </div>
        </Modal>
      )}
    </section>
  );
}
