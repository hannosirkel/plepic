"use client";

/**
 * The second `<select>` the Omniva parcel machine method needs: a specific
 * machine, grouped by county and town.
 *
 * Extracted out of `CheckoutPageContent.tsx` rather than inlined there. That
 * file is already large, and this piece has its own, fully self-contained
 * concern — turning a fetched machine list into a grouped `<select>`, with
 * the loading and error states that come with fetching it — which does not
 * need any of the cart, address or payment state the rest of that file
 * carries. `CheckoutPageContent` still owns *when* to fetch, *what* to fetch
 * for and *what happens* once a machine is chosen (adding the shipping
 * method, carrying the zip): those are checkout concerns this component has
 * no business making decisions about, so it is handed the list and reports a
 * chosen zip back through {@link ParcelMachinePickerProps.onChange}.
 */

import type { StorefrontParcelMachine } from "../../lib/omniva-locations.js";
import styles from "../../styles/pages/shop.module.css";

export interface ParcelMachinePickerProps {
  /** The `<select>`'s accessible name — there is no visible `<label>` beside it. */
  readonly label: string;
  /** The unchosen option's text. */
  readonly prompt: string;
  /**
   * The machines to offer, in the order the backend returned them —
   * `GET /store/omniva/parcel-machines` groups and sorts this list, so this
   * component does not re-sort it. See {@link groupContiguous}.
   */
  readonly machines: readonly StorefrontParcelMachine[];
  /** The chosen zip, or `""` for none. */
  readonly value: string;
  /** The status text to show while the list is loading, or `null` once it is settled. */
  readonly loading: string | null;
  /** Shown in place of the list when the machine list could not be fetched. */
  readonly errorMessage: string | null;
  readonly disabled: boolean;
  readonly onChange: (zip: string) => void;
}

interface ParcelMachineGroup {
  readonly group: string;
  readonly machines: readonly StorefrontParcelMachine[];
}

/**
 * Folds a **contiguous-by-group** list into `<optgroup>`s, without sorting or
 * re-grouping it.
 *
 * `backend/src/modules/omniva/locations.ts`'s `parcelMachinesForCountry`
 * already sorts by group and then by name, so every machine in one group is
 * already adjacent to the rest of it — grouping here is a fold, not a second
 * sort, and this function trusts that order rather than repeating the work.
 * A list that arrived out of order would render as more, smaller groups
 * rather than throw; the backend's contract is the reason that never
 * happens, not a check this function makes.
 */
function groupContiguous(
  machines: readonly StorefrontParcelMachine[],
): readonly ParcelMachineGroup[] {
  const groups: { group: string; machines: StorefrontParcelMachine[] }[] = [];
  for (const machine of machines) {
    const last = groups[groups.length - 1];
    if (last !== undefined && last.group === machine.group) {
      last.machines.push(machine);
    } else {
      groups.push({ group: machine.group, machines: [machine] });
    }
  }
  return groups;
}

export function ParcelMachinePicker({
  label,
  prompt,
  machines,
  value,
  loading,
  errorMessage,
  disabled,
  onChange,
}: ParcelMachinePickerProps) {
  const groups = groupContiguous(machines);
  return (
    <>
      <select
        className={`${styles.field} ${styles.select}`}
        aria-label={label}
        value={value}
        disabled={disabled || machines.length === 0}
        onChange={(event) => onChange(event.currentTarget.value)}
      >
        <option value="">{prompt}</option>
        {groups.map(({ group, machines: groupMachines }) => (
          <optgroup key={group} label={group}>
            {groupMachines.map((machine) => (
              <option key={machine.zip} value={machine.zip}>
                {machine.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      {/* `role="status"`/`role="alert"` rather than a silently empty
          `<select>`: a picker with nothing in it looks broken, not loading
          or unavailable, unless something says which. */}
      {loading === null ? null : (
        <p className={styles.note} role="status">
          {loading}
        </p>
      )}
      {errorMessage === null ? null : (
        <p className={styles.error} role="alert">
          {errorMessage}
        </p>
      )}
    </>
  );
}
