"use client";

/**
 * The Omniva parcel machine method's second control, as a hook: the fetched
 * machine list, the buyer's chosen zip, and the request bookkeeping that
 * keeps a stale country's list — or a stale zip — from surviving a changed
 * address.
 *
 * Extracted out of `CheckoutPageContent.tsx`, which was already large before
 * this feature and grows further still: a later task adds a conditional
 * phone field to the same file. That growth compounds, so the selection
 * concern — state, the fetch effect, `selectParcelMachine`, and its own
 * request-invalidation counter — moves out now rather than after the next
 * addition makes it more entangled.
 *
 * **What stays in `CheckoutPageContent.tsx`, and why.** The Store API call
 * that actually adds a shipping method does not move here. `selectShippingOption`
 * (choosing the method itself) and `selectParcelMachine` (choosing a machine
 * for it) are two different decisions about *whether* to add a method, and
 * both converge on the same request once the decision is "yes" — the shown-
 * versus-charged guard inside `addGuestShippingMethod` has to stay wired to
 * one call site, not two that could drift. So this hook is handed that call
 * as `addMethod`, and calls it once a zip exists; it never calls the Store
 * API to *add* anything itself, only to *list* machines through
 * `fetchParcelMachines`, which is a same-origin read with no cart effect.
 */

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";

import { destinationForCountryName } from "../../lib/destination.js";
import { fetchParcelMachines, type StorefrontParcelMachine } from "../../lib/omniva-locations.js";
import { isParcelMachineOption, type GuestShippingOption } from "../../lib/store-checkout.js";

export type ParcelMachineFetchState = "idle" | "loading" | "error";

export interface ParcelMachineSelection {
  /** Whether the currently selected delivery method is the one this hook manages. */
  readonly selectedIsParcelMachine: boolean;
  readonly parcelMachines: readonly StorefrontParcelMachine[];
  /** The chosen zip, or `""` for none yet. */
  readonly parcelMachineZip: string;
  readonly parcelMachineState: ParcelMachineFetchState;
  /**
   * Picks a machine. Clearing the picker back to its unchosen option
   * (`zip === ""`) is recorded, not treated as an error — the method is
   * still selected, just not addable yet, the same "wait, don't fail" answer
   * `CheckoutPageContent.tsx`'s `selectShippingOption` gives an incomplete
   * method choice.
   */
  readonly selectParcelMachine: (zip: string) => void;
  /**
   * Drops the fetched list, the chosen zip, and invalidates any fetch in
   * flight. Call this from whatever already resets the delivery-method list
   * for a changed address, in the same synchronous pass — see
   * `CheckoutPageContent.tsx`'s address-keyed effect, which is where the
   * four resets this joins already live, for the effect/event-gap reasoning.
   */
  readonly resetParcelMachineSelection: () => void;
}

export interface UseParcelMachineSelectionArgs {
  /** The currently selected delivery method, or `undefined` if none. */
  readonly selectedOption: GuestShippingOption | undefined;
  /** The address the delivery-method list was fetched for, or `null`. */
  readonly shippingOptionsAddress: string | null;
  /** The completed address's own revision, or `null` while it is incomplete. */
  readonly addressRevision: string | null;
  /** The country name off the address form, read once a machine is chosen. */
  readonly countryName: string;
  /** True while a real order attempt is in flight — the guard every control here shares. */
  readonly attemptInFlight: MutableRefObject<boolean>;
  /**
   * The add-shipping-method request counter `CheckoutPageContent.tsx` also
   * bumps from `selectShippingOption`, shared rather than duplicated: picking
   * a machine has to invalidate a response already in flight for a different
   * choice, and the reverse, and there is only one meaningful "most recent
   * request" between the two controls.
   */
  readonly shippingRequest: MutableRefObject<number>;
  /** Clears the totals shown while a new shipping-method request is pending. */
  readonly clearTotals: () => void;
  /** Adds the method now that it has a zip to carry. */
  readonly addMethod: (option: GuestShippingOption, zip: string) => void;
}

export function useParcelMachineSelection({
  selectedOption,
  shippingOptionsAddress,
  addressRevision,
  countryName,
  attemptInFlight,
  shippingRequest,
  clearTotals,
  addMethod,
}: UseParcelMachineSelectionArgs): ParcelMachineSelection {
  const [parcelMachines, setParcelMachines] = useState<readonly StorefrontParcelMachine[]>([]);
  const [parcelMachineZip, setParcelMachineZip] = useState("");
  const [parcelMachineState, setParcelMachineState] = useState<ParcelMachineFetchState>("idle");
  const parcelMachineRequest = useRef(0);

  const selectedIsParcelMachine =
    selectedOption !== undefined && isParcelMachineOption(selectedOption);

  // Stable identity (no dependencies): safe to call unconditionally from an
  // effect elsewhere without that effect having to list it.
  const resetParcelMachineSelection = useCallback(() => {
    ++parcelMachineRequest.current;
    setParcelMachines([]);
    setParcelMachineZip("");
    setParcelMachineState("idle");
  }, []);

  /*
   * Fetched once the buyer has actually selected the method — not prefetched
   * the moment the address is complete. Nothing about the Omniva parcel
   * machine method runs ahead of the buyer choosing it.
   *
   * Keyed on `shippingOptionsAddress` matching `addressRevision`, not on the
   * address's fields directly: `selectedIsParcelMachine` only means anything
   * once the debounced method list has settled for the *current* address,
   * and reading the country before then would ask this address's endpoint
   * with the previous one's country code for the one render in between.
   */
  useEffect(() => {
    const request = ++parcelMachineRequest.current;
    if (
      !selectedIsParcelMachine ||
      addressRevision === null ||
      shippingOptionsAddress !== addressRevision
    ) {
      setParcelMachines([]);
      setParcelMachineState("idle");
      return;
    }
    const destination = destinationForCountryName(countryName.trim());
    if (destination === null) {
      setParcelMachines([]);
      setParcelMachineState("idle");
      return;
    }
    let active = true;
    setParcelMachineState("loading");
    void fetchParcelMachines(destination.code.toUpperCase()).then(
      (machines) => {
        if (!active || request !== parcelMachineRequest.current) return;
        setParcelMachines(machines);
        setParcelMachineState("idle");
      },
      () => {
        if (!active || request !== parcelMachineRequest.current) return;
        setParcelMachines([]);
        setParcelMachineState("error");
      },
    );
    return () => {
      active = false;
    };
  }, [selectedIsParcelMachine, shippingOptionsAddress, addressRevision, countryName]);

  function selectParcelMachine(zip: string): void {
    if (
      attemptInFlight.current ||
      shippingOptionsAddress !== addressRevision ||
      addressRevision === null ||
      selectedOption === undefined ||
      !isParcelMachineOption(selectedOption)
    ) return;
    ++shippingRequest.current;
    setParcelMachineZip(zip);
    clearTotals();
    if (zip === "") return;
    addMethod(selectedOption, zip);
  }

  return {
    selectedIsParcelMachine,
    parcelMachines,
    parcelMachineZip,
    parcelMachineState,
    selectParcelMachine,
    resetParcelMachineSelection,
  };
}
