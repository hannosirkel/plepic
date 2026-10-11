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
 *
 * Its own four sentences — the accessible name, the unchosen option, and what
 * it says while the list loads or when it could not be loaded — are read from
 * the copy of the edition it is given. The groups and the machines are the
 * carrier's place names, and are shown as the carrier writes them in every
 * edition.
 */

import { siteCopyFor } from "../../../../content/editions.js";
import { DEFAULT_LOCALE, type Locale } from "../../../../content/routes.js";
import type { StorefrontParcelMachine } from "../../lib/omniva-locations.js";
import styles from "../../styles/pages/shop.module.css";

export interface ParcelMachinePickerProps {
  /** The edition whose words the picker speaks. The default edition's when absent. */
  readonly locale?: Locale;
  /**
   * The machines to offer, in the order the backend returned them —
   * `GET /store/omniva/parcel-machines` groups and sorts this list, so this
   * component does not re-sort it. See {@link groupContiguous}.
   */
  readonly machines: readonly StorefrontParcelMachine[];
  /** The chosen zip, or `""` for none. */
  readonly value: string;
  /** Where the fetch of the machine list stands: `loading` and `error` each say so in words. */
  readonly state: "idle" | "loading" | "error";
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
  locale = DEFAULT_LOCALE,
  machines,
  value,
  state,
  disabled,
  onChange,
}: ParcelMachinePickerProps) {
  const copy = siteCopyFor(locale).shop.checkout.delivery;
  const groups = groupContiguous(machines);
  return (
    <>
      {/* No visible `<label>` stands beside it, so the name is the `aria-label`. */}
      <select
        className={`${styles.field} ${styles.select}`}
        aria-label={copy.parcelMachineLabel}
        value={value}
        disabled={disabled || machines.length === 0}
        onChange={(event) => onChange(event.currentTarget.value)}
      >
        <option value="">{copy.parcelMachinePrompt}</option>
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
      {state === "loading" ? (
        <p className={styles.note} role="status">
          {copy.parcelMachineLoading}
        </p>
      ) : null}
      {state === "error" ? (
        <p className={styles.error} role="alert">
          {copy.parcelMachineUnavailable}
        </p>
      ) : null}
    </>
  );
}
