<?php


namespace Dibs\EasyCheckout\Controller\Order;
use Dibs\EasyCheckout\Controller\Checkout;
use Dibs\EasyCheckout\Model\Client\ClientException;

class SaveOrder extends Checkout
{
    public function execute()
    {
        /*
        if ($this->ajaxRequestAllowed()) {
            return;
        }
        */

        $checkout = $this->getDibsCheckout();
        $checkout->setCheckoutContext($this->dibsCheckoutContext);

        // todo? csrf...
        //$ctrlkey    = (string)$this->getRequest()->getParam('ctrlkey');
        $paymentId  = $this->getRequest()->getParam('pid');
        $session = $this->getCheckoutSession();

        $checkoutPaymentId = $session->getDibsPaymentId();
        $quote = $this->getDibsCheckout()->getQuote();

        if (!$quote) {
            return $this->respondWithError("Your session has expired. Quote missing.");
        }

        // Todo remove comment when stopped testing
        if (!$paymentId || !$checkoutPaymentId || ($paymentId != $checkoutPaymentId)) {
            $checkout->getLogger()->error("Invalid request");
            if (!$checkoutPaymentId) {
                $checkout->getLogger()->error("Save Order: No dibs checkout payment id in session.");
                return $this->respondWithError("Your session has expired.");
            }

            if ($paymentId != $checkoutPaymentId) {
                return $checkout->getLogger()->error("Save Order: The session has expired or is wrong.");
            }

            return $checkout->getLogger()->error("Save Order: Invalid data.");
        }



        try {
            $payment = $checkout->getDibsPaymentHandler()->loadDibsPaymentById($paymentId);
        } catch (ClientException $e) {
            if ($e->getHttpStatusCode() == 404) {
                $checkout->getLogger()->error("Save Order: The dibs payment with ID: " . $paymentId . " was not found in dibs.");
                return $this->respondWithError("Could not create an order. The payment was not found in dibs.");
            } else {
                $checkout->getLogger()->error("Save Order: Something went wrong when we tried to fetch the payment ID from Dibs. Http Status code: " . $e->getHttpStatusCode());
                $checkout->getLogger()->error("Error message:" . $e->getMessage());
                $checkout->getLogger()->debug($e->getResponseBody());

                return $this->respondWithError("Could not create an order, please contact site admin. Dibs seems to be down!");
            }
        } catch (\Exception $e) {
            $this->messageManager->addExceptionMessage(
                $e,
                __('Something went wrong.')
            );

            $checkout->getLogger()->error("Save Order: Something went wrong. Might have been the request parser. Payment ID: ". $checkoutPaymentId. "... Error message:" . $e->getMessage());
            return $this->respondWithError("Something went wrong... Contact site admin.");
        }

        if ($payment->getOrderDetails()->getReference() !== $checkout->getDibsPaymentHandler()->generateReferenceByQuoteId($quote->getId())) {
            $checkout->getLogger()->error("Save Order: The customer Quote ID doesn't match with the dibs payment reference: " . $payment->getOrderDetails()->getReference());
            return $this->respondWithError("Could not create an order. Invalid data. Contact admin.");
        }

        if ($payment->getSummary()->getReservedAmount() === null) {
            $checkout->getLogger()->error("Save Order: Found no summary for the payment id: " . $payment->getPaymentId() . "... This must mean that they customer hasn't checked out yet!");
            return $this->respondWithError("We could not create your order... The payment hasn't reached Dibs. Payment id: " . $payment->getPaymentId());
        }


        try {
            $order = $checkout->placeOrder($payment, $quote);
        } catch (\Exception $e) {
            $checkout->getLogger()->error("Could not place order for dibs payment with payment id: " . $payment->getPaymentId() . ", Quote ID:" . $quote->getId());
            $checkout->getLogger()->error("Error message:" . $e->getMessage());

           return $this->respondWithError("We could not create your order. Please contact the site admin with this error and payment id: " . $payment->getPaymentId());
        }


        try {

            $this->dibsCheckout->updateMagentoPaymentReference($order, $paymentId);
        } catch (\Exception $e) {
            $checkout->getLogger()->error("
                Order created with ID: " . $order->getIncrementId(). ". 
                But we could not update reference ID at dibs. Please handle it manually, it has id: quote_id_: ".$quote->getId()."...  Dibs Payment ID: " . $payment->getPaymentId()
            );

            $checkout->getLogger()->error("Error message:" . $e->getMessage());
            // lets ignore this and save it in logs! let customer see his/her order confirmation!
        }


        // clear old sessions
        $session->clearHelperData();
        $session->clearQuote()->clearStorage();


        // we set new sessions
        $session
            ->setLastQuoteId($order->getQuoteId())
            ->setLastSuccessQuoteId($order->getQuoteId())
            ->setLastOrderId($order->getId())
            ->setLastRealOrderId($order->getIncrementId())
            ->setLastOrderStatus($order->getStatus());


        $this->getResponse()->setBody(json_encode(
            array(
                'redirectTo' => $this->dibsCheckoutContext->getHelper()->getSuccessPageUrl()
            )
        ));
        return false;
    }


    protected function respondWithError($message,$redirectTo = false, $extraData = [])
    {
        $data = array('messages' => $message, "redirectTo" => $redirectTo);
        $data = array_merge($data, $extraData);
        $this->getResponse()->setBody(json_encode($data));
        return false;
    }

}