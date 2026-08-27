import { AbstractFulfillmentProviderService } from "@medusajs/framework/utils";
import type { FulfillmentOption } from "@medusajs/framework/types";

/** The parcel machine method's option id, as `getFulfillmentOptions` returns it. */
export const OMNIVA_PARCEL_MACHINE_OPTION_ID = "omniva-parcel-machine";
/** The courier method's option id. Not sold yet; Task 9 registers against it. */
export const OMNIVA_COURIER_OPTION_ID = "omniva-courier";

/**
 * Omniva, as a Medusa fulfillment provider.
 *
 * Registration with the carrier happens in `createFulfillment` and **nowhere
 * else**, so the customer's path — cart completion, `order.placed`, the
 * confirmation email — never calls Omniva. A refusal here fails the fulfilment
 * in front of the operator, which is the containment the design asks for, and
 * it is structural rather than a `try`/`catch` a later edit could remove.
 */
export default class OmnivaFulfillmentProviderService extends AbstractFulfillmentProviderService {
  static identifier = "omniva";

  /**
   * The two delivery channels OMX serves. `optionData` carries the channel so
   * that the registration body reads it from the option rather than comparing
   * the option's display name, which an operator can rename in the Admin.
   */
  async getFulfillmentOptions(): Promise<FulfillmentOption[]> {
    return [
      { id: OMNIVA_PARCEL_MACHINE_OPTION_ID, name: "Omniva parcel machine", deliveryChannel: "PARCEL_MACHINE" },
      { id: OMNIVA_COURIER_OPTION_ID, name: "Omniva courier", deliveryChannel: "COURIER" },
    ];
  }

  /**
   * `false`, and it stays false. Both rates are stored flat prices; nothing is
   * quoted from the carrier, so there is no quote to time out and no second
   * figure a fallback could disagree with. ADR 020 records the reasoning.
   */
  async canCalculate(): Promise<boolean> {
    return false;
  }
}
