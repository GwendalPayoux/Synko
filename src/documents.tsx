import { DocumentViewer } from './document-viewer';
import { useEffect, useRef, useState } from 'react';
import { FileText, Upload, Download, History, FolderOpen } from 'lucide-react';
import { api, type Document, type Project, type User } from './domain';
import { Empty, Modal, Field } from './components';
import { type Folder } from './modules';
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
  user,
}: {
  project: Project;
  canWrite: boolean;
  onError: (s: string) => void;
  user: User;
}) {
  const [docs, setDocs] = useState<Document[]>([]),
    [selected, setSelected] = useState<Document | null>(null),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [query, setQuery] = useState('');
  const [folders, setFolders] = useState<Folder[]>([]),
    [folder, setFolder] = useState(''),
    [archived, setArchived] = useState(false),
    [folderEdit, setFolderEdit] = useState<
      Folder | { id: string; name: string; parent_id: string | null } | null
    >(null),
    [documentTab, setDocumentTab] = useState<'info' | 'versions'>('info');
  const input = useRef<HTMLInputElement>(null),
    [target, setTarget] = useState<Document | null>(null);
  const base = `/projects/${project.id}/documents`;
  async function load() {
    setDocs(await api<Document[]>(base));
    setFolders(await api<Folder[]>(`/projects/${project.id}/folders`));
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
          (target
            ? `/${target.id}/versions`
            : `?name=${encodeURIComponent(file.name)}&folder_id=${encodeURIComponent(folder === 'all' ? '' : folder)}`),
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
  function history(doc: Document) {
    setDocumentTab('versions');
    setSelected(doc);
  }
  if (selected)
    return (
      <>
        <input ref={input} type="file" hidden onChange={(e) => upload(e.target.files?.[0])} />
        <DocumentViewer
          document={docs.find((d) => d.id === selected.id) || selected}
          project={project}
          user={user}
          folders={folders}
          initialTab={documentTab}
          onChanged={load}
          onError={onError}
          busy={busy}
          onUpload={() => {
            setTarget(selected);
            input.current?.click();
          }}
          onClose={() => {
            const id = selected.id;
            setSelected(null);
            requestAnimationFrame(() =>
              window.document
                .querySelector<HTMLButtonElement>('[data-document-id="' + CSS.escape(id) + '"]')
                ?.focus(),
            );
          }}
        />
      </>
    );
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
        <select
          aria-label="Dossier courant"
          value={folder}
          onChange={(e) => setFolder(e.target.value)}
        >
          <option value="">Racine</option>
          <option value="all">Tous les dossiers</option>
          {folders.map((f) => (
            <option key={f.id} value={f.id}>
              {f.parent_id ? '↳ ' : ''}
              {f.name}
            </option>
          ))}
        </select>
        {canWrite && (
          <button
            className="secondary"
            onClick={() =>
              setFolderEdit({
                id: '',
                name: '',
                parent_id: folder && folder !== 'all' ? folder : null,
              })
            }
          >
            Nouveau dossier
          </button>
        )}
        {canWrite && folders.some((f) => f.id === folder) && (
          <button
            className="secondary"
            onClick={() => setFolderEdit(folders.find((f) => f.id === folder)!)}
          >
            Modifier le dossier
          </button>
        )}
        <label className="check-field">
          <input
            type="checkbox"
            checked={archived}
            onChange={(e) => setArchived(e.target.checked)}
          />
          Archives
        </label>
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
                .filter(
                  (d) =>
                    d.name.toLowerCase().includes(query.toLowerCase()) &&
                    (folder === 'all' || (d.folder_id || '') === folder) &&
                    !!d.archived_at === archived,
                )
                .map((d) => (
                  <tr key={d.id}>
                    <td>
                      <button
                        className="file-name document-open"
                        data-document-id={d.id}
                        onClick={() => {
                          setDocumentTab('info');
                          setSelected(d);
                        }}
                        aria-label={'Ouvrir ' + d.name}
                      >
                        <FileText size={20} />
                        {d.name}
                      </button>
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
      {folderEdit && (
        <Modal
          title={folderEdit.id ? 'Modifier le dossier' : 'Créer un dossier'}
          onClose={() => setFolderEdit(null)}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const b = Object.fromEntries(new FormData(e.currentTarget));
              try {
                await api(
                  `/projects/${project.id}/folders${folderEdit.id ? '/' + folderEdit.id : ''}`,
                  folderEdit.id ? 'PATCH' : 'POST',
                  b,
                );
                await load();
                setFolderEdit(null);
              } catch (e) {
                onError((e as Error).message);
              }
            }}
          >
            <Field label="Nom du dossier">
              <input name="name" defaultValue={folderEdit.name} required maxLength={120} />
            </Field>
            <Field label="Dossier parent">
              <select name="parent_id" defaultValue={folderEdit.parent_id || ''}>
                <option value="">Racine</option>
                {folders
                  .filter((f) => f.id !== folderEdit.id)
                  .map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
              </select>
            </Field>
            <button className="primary">Enregistrer le dossier</button>
          </form>
        </Modal>
      )}
    </section>
  );
}
