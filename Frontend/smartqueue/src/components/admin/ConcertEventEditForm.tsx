import React from 'react';
import { MdSave, MdCancel } from 'react-icons/md';
import { CONCERT_ARTIST_MAX_LEN, type ConcertEvent } from '../../types/concertEvent';
import {
  VENUE_MAX_LEN,
  VENUE_OTHER,
  VENUE_PRESETS,
  isVenueIncomplete,
  venueOtherInputValue,
  venueSelectValue,
} from '../../utils/concertVenue';
import ConfirmDialog from '../ui/ConfirmDialog';
import {
  publicationConfirmBody,
  publicationConfirmTitle,
} from '../../utils/publicationConfirmMessages';

export interface ConcertEventEditFormProps {
  value: ConcertEvent;
  onChange: (next: ConcertEvent) => void;
  onSave: () => void;
  onCancel: () => void;
}

type RequiredKey = 'name' | 'artist' | 'genre' | 'date' | 'venue' | 'capacity';

const initialRequired: Record<RequiredKey, boolean> = {
  name: false,
  artist: false,
  genre: false,
  date: false,
  venue: false,
  capacity: false,
};

const ConcertEventEditForm: React.FC<ConcertEventEditFormProps> = ({
  value: editingEvent,
  onChange: setEditingEvent,
  onSave,
  onCancel,
}) => {
  const [publicationConfirmNext, setPublicationConfirmNext] = React.useState<boolean | null>(null);
  const [requiredEmpty, setRequiredEmpty] = React.useState<Record<RequiredKey, boolean>>(initialRequired);
  const [invalidArtistLength, setInvalidArtistLength] = React.useState(false);
  const [invalidPriceRange, setInvalidPriceRange] = React.useState(false);
  const publishedNow = editingEvent.published ?? false;

  React.useEffect(() => {
    setRequiredEmpty(initialRequired);
    setInvalidArtistLength(false);
    setInvalidPriceRange(false);
  }, [editingEvent.id]);

  const switchId = `publication-switch-${editingEvent.id}`;
  const publicationSectionId = `publication-section-${editingEvent.id}`;

  const openPublicationConfirm = () => {
    setPublicationConfirmNext(!publishedNow);
  };

  const applyPublicationConfirm = () => {
    if (publicationConfirmNext === null) return;
    setEditingEvent({ ...editingEvent, published: publicationConfirmNext });
    setPublicationConfirmNext(null);
  };

  const handleSaveClick = () => {
    const min = editingEvent.ticketPriceMin;
    const max = editingEvent.ticketPriceMax;
    const priceBad = Number.isFinite(min) && Number.isFinite(max) && min > max;
    const artistTrim = editingEvent.artist.trim();
    const artistEmpty = !artistTrim;
    const artistLenBad = !artistEmpty && editingEvent.artist.length > CONCERT_ARTIST_MAX_LEN;

    const nextRequired: Record<RequiredKey, boolean> = {
      name: !editingEvent.name.trim(),
      artist: artistEmpty,
      genre: !editingEvent.genre.trim(),
      date: !editingEvent.date,
      venue: isVenueIncomplete(editingEvent.venue),
      capacity: !Number.isFinite(editingEvent.capacity) || editingEvent.capacity < 1,
    };

    setRequiredEmpty(nextRequired);
    setInvalidArtistLength(artistLenBad);
    setInvalidPriceRange(priceBad);

    if (Object.values(nextRequired).some(Boolean) || artistLenBad || priceBad) return;
    onSave();
  };

  const artistInputInvalid = requiredEmpty.artist || invalidArtistLength;

  return (
    <div className="edit-form event-edit-form">
      <div className="event-info">
        <div className="event-info-header event-info-header--edit">
          <div className="event-title-field">
            <label className="event-title-label" htmlFor={`edit-event-name-${editingEvent.id}`}>
              Event name
            </label>
            <input
              id={`edit-event-name-${editingEvent.id}`}
              type="text"
              className={`event-title-input${requiredEmpty.name ? ' is-invalid' : ''}`}
              value={editingEvent.name}
              onChange={(e) => {
                setRequiredEmpty((r) => ({ ...r, name: false }));
                setEditingEvent({ ...editingEvent, name: e.target.value });
              }}
              placeholder="Event name"
            />
            {requiredEmpty.name && (
              <span className="field-inline-error" role="alert">
                Need to fill
              </span>
            )}
          </div>
          <div className="event-info-toolbar">
            <div className="event-status-field">
              <label className="event-status-label" htmlFor={`edit-event-status-${editingEvent.id}`}>
                Status
              </label>
              <select
                id={`edit-event-status-${editingEvent.id}`}
                className="event-status-select"
                value={editingEvent.status}
                onChange={(e) =>
                  setEditingEvent({
                    ...editingEvent,
                    status: e.target.value as ConcertEvent['status'],
                  })
                }
              >
                <option value="upcoming">Upcoming</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
        </div>
        <dl className="event-detail-rows">
          <div className="event-detail-row">
            <dt>
              <label htmlFor={`edit-artist-${editingEvent.id}`}>Artist</label>
            </dt>
            <dd>
              <input
                id={`edit-artist-${editingEvent.id}`}
                type="text"
                className={`event-field-input${artistInputInvalid ? ' is-invalid' : ''}`}
                maxLength={CONCERT_ARTIST_MAX_LEN}
                value={editingEvent.artist}
                onChange={(e) => {
                  setRequiredEmpty((r) => ({ ...r, artist: false }));
                  setInvalidArtistLength(false);
                  setEditingEvent({
                    ...editingEvent,
                    artist: e.target.value.slice(0, CONCERT_ARTIST_MAX_LEN),
                  });
                }}
              />
              {requiredEmpty.artist && (
                <span className="field-inline-error" role="alert">
                  Need to fill
                </span>
              )}
              {!requiredEmpty.artist && invalidArtistLength && (
                <span className="field-inline-error" role="alert">
                  Not valid
                </span>
              )}
            </dd>
          </div>
          <div className="event-detail-row">
            <dt>
              <label htmlFor={`edit-genre-${editingEvent.id}`}>Genre</label>
            </dt>
            <dd>
              <select
                id={`edit-genre-${editingEvent.id}`}
                className={`event-field-input${requiredEmpty.genre ? ' is-invalid' : ''}`}
                value={editingEvent.genre}
                onChange={(e) => {
                  setRequiredEmpty((r) => ({ ...r, genre: false }));
                  setEditingEvent({ ...editingEvent, genre: e.target.value });
                }}
              >
                <option value="">Select genre</option>
                <option value="Rock">Rock</option>
                <option value="Pop">Pop</option>
                <option value="Jazz">Jazz</option>
                <option value="Electronic">Electronic</option>
                <option value="Classical">Classical</option>
                <option value="Hip-Hop">Hip-Hop</option>
              </select>
              {requiredEmpty.genre && (
                <span className="field-inline-error" role="alert">
                  Need to fill
                </span>
              )}
            </dd>
          </div>
          <div className="event-detail-row">
            <dt>
              <label htmlFor={`edit-date-${editingEvent.id}`}>Date</label>
            </dt>
            <dd>
              <input
                id={`edit-date-${editingEvent.id}`}
                type="date"
                className={`event-field-input${requiredEmpty.date ? ' is-invalid' : ''}`}
                value={editingEvent.date}
                onChange={(e) => {
                  setRequiredEmpty((r) => ({ ...r, date: false }));
                  setEditingEvent({ ...editingEvent, date: e.target.value });
                }}
              />
              {requiredEmpty.date && (
                <span className="field-inline-error" role="alert">
                  Need to fill
                </span>
              )}
            </dd>
          </div>
          <div className="event-detail-row">
            <dt>
              <label htmlFor={`edit-venue-${editingEvent.id}`}>Venue</label>
            </dt>
            <dd className="event-venue-edit-dd">
              <select
                id={`edit-venue-${editingEvent.id}`}
                className={`event-field-input${requiredEmpty.venue ? ' is-invalid' : ''}`}
                value={venueSelectValue(editingEvent.venue)}
                onChange={(e) => {
                  setRequiredEmpty((r) => ({ ...r, venue: false }));
                  const v = e.target.value;
                  if (v === VENUE_OTHER) {
                    setEditingEvent({ ...editingEvent, venue: VENUE_OTHER });
                  } else {
                    setEditingEvent({ ...editingEvent, venue: v });
                  }
                }}
              >
                <option value="">Select venue</option>
                {VENUE_PRESETS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
                <option value={VENUE_OTHER}>Other (type below)</option>
              </select>
              {venueSelectValue(editingEvent.venue) === VENUE_OTHER && (
                <input
                  type="text"
                  className={`event-field-input venue-other-input${requiredEmpty.venue ? ' is-invalid' : ''}`}
                  placeholder="Venue name (max 100 characters)"
                  maxLength={VENUE_MAX_LEN}
                  value={venueOtherInputValue(editingEvent.venue)}
                  onChange={(e) => {
                    setRequiredEmpty((r) => ({ ...r, venue: false }));
                    setEditingEvent({
                      ...editingEvent,
                      venue: e.target.value.slice(0, VENUE_MAX_LEN),
                    });
                  }}
                  aria-label="Custom venue name"
                />
              )}
              {requiredEmpty.venue && (
                <span className="field-inline-error" role="alert">
                  Need to fill
                </span>
              )}
            </dd>
          </div>
          <div className="event-detail-row">
            <dt>
              <label htmlFor={`edit-capacity-${editingEvent.id}`}>Capacity</label>
            </dt>
            <dd>
              <input
                id={`edit-capacity-${editingEvent.id}`}
                type="number"
                className={`event-field-input${requiredEmpty.capacity ? ' is-invalid' : ''}`}
                min={0}
                value={editingEvent.capacity}
                onChange={(e) => {
                  setRequiredEmpty((r) => ({ ...r, capacity: false }));
                  setEditingEvent({
                    ...editingEvent,
                    capacity: parseInt(e.target.value, 10) || 0,
                  });
                }}
              />
              {requiredEmpty.capacity && (
                <span className="field-inline-error" role="alert">
                  Need to fill
                </span>
              )}
            </dd>
          </div>
          <div className="event-detail-row">
            <dt>Ticket price (range)</dt>
            <dd>
              <div className="event-price-range-inputs">
                <input
                  type="number"
                  className={`event-field-input${invalidPriceRange ? ' is-invalid' : ''}`}
                  step="0.01"
                  min={0}
                  placeholder="Min"
                  value={editingEvent.ticketPriceMin || ''}
                  onChange={(e) => {
                    setInvalidPriceRange(false);
                    setEditingEvent({
                      ...editingEvent,
                      ticketPriceMin: parseFloat(e.target.value) || 0,
                    });
                  }}
                  aria-label="Minimum ticket price"
                  aria-invalid={invalidPriceRange}
                />
                <span className="price-range-sep" aria-hidden>
                  to
                </span>
                <input
                  type="number"
                  className={`event-field-input${invalidPriceRange ? ' is-invalid' : ''}`}
                  step="0.01"
                  min={0}
                  placeholder="Max"
                  value={editingEvent.ticketPriceMax || ''}
                  onChange={(e) => {
                    setInvalidPriceRange(false);
                    setEditingEvent({
                      ...editingEvent,
                      ticketPriceMax: parseFloat(e.target.value) || 0,
                    });
                  }}
                  aria-label="Maximum ticket price"
                  aria-invalid={invalidPriceRange}
                />
              </div>
              {invalidPriceRange && (
                <span className="field-inline-error" role="alert">
                  Not valid
                </span>
              )}
            </dd>
          </div>
        </dl>

        <section
          className="event-edit-section event-edit-section--publication"
          aria-labelledby={publicationSectionId}
        >
          <h3 id={publicationSectionId} className="event-edit-section-heading">
            Publication
          </h3>
          <div className="event-publication-switch-block">
            <span
              className={`event-publication-state-label ${!publishedNow ? 'is-active' : ''}`}
              id={`${switchId}-unpublished-label`}
            >
              Unpublished
            </span>
            <button
              type="button"
              id={switchId}
              role="switch"
              aria-checked={publishedNow}
              aria-label={publishedNow ? 'Published' : 'Unpublished'}
              className={`event-publication-switch ${publishedNow ? 'is-on' : ''}`}
              onClick={openPublicationConfirm}
            >
              <span className="event-publication-switch-thumb" aria-hidden />
            </button>
            <span
              className={`event-publication-state-label ${publishedNow ? 'is-active' : ''}`}
              id={`${switchId}-published-label`}
            >
              Published
            </span>
          </div>
        </section>

        <div className="event-edit-form-footer">
          <button type="button" className="cancel-btn" onClick={onCancel}>
            <MdCancel /> Cancel
          </button>
          <button type="button" className="save-btn" onClick={handleSaveClick}>
            <MdSave /> Save
          </button>
        </div>

        <ConfirmDialog
          open={publicationConfirmNext !== null}
          title={
            publicationConfirmNext === null ? '' : publicationConfirmTitle(publicationConfirmNext)
          }
          message={
            publicationConfirmNext === null ? '' : publicationConfirmBody(publicationConfirmNext)
          }
          confirmLabel={publicationConfirmNext ? 'Publish' : 'Unpublish'}
          cancelLabel="Cancel"
          confirmVariant={publicationConfirmNext ? 'primary' : 'danger'}
          onConfirm={applyPublicationConfirm}
          onCancel={() => setPublicationConfirmNext(null)}
        />
      </div>
    </div>
  );
};

export default ConcertEventEditForm;
