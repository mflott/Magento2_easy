<?php

namespace Dibs\EasyCheckout\Controller\Order;

use Dibs\EasyCheckout\Controller\Checkout;
use Dibs\EasyCheckout\Model\Checkout as DibsCheckout;
use Dibs\EasyCheckout\Model\CheckoutContext as DibsCheckoutCOntext;
use Dibs\EasyCheckout\Model\Client\DTO\Payment\CreatePaymentWebhook;
use Magento\Customer\Api\AccountManagementInterface;
use Magento\Customer\Api\CustomerRepositoryInterface;
use Magento\Quote\Model\Quote;
use Dibs\EasyCheckout\Logger\Logger;
use Magento\Quote\Model\ResourceModel\Quote\CollectionFactory as QuoteCollectionFactory;
use \Magento\Sales\Model\ResourceModel\Order\CollectionFactory as OrderCollectionFactory;

class PaymentCompleteCallback extends Checkout
{
    /** @var Logger */
    protected $logger;

    /** @var QuoteCollectionFactory */
    private $quoteCollectionFactory;

    /** @var OrderCollectionFactory */
    private $orderCollectionFactory;

    public function __construct(
        \Magento\Framework\App\Action\Context $context,
        \Magento\Customer\Model\Session $customerSession,
        CustomerRepositoryInterface $customerRepository,
        AccountManagementInterface $accountManagement,
        \Magento\Checkout\Model\Session $checkoutSession,
        \Magento\Store\Model\StoreManagerInterface $storeManager,
        \Magento\Framework\View\Result\PageFactory $resultPageFactory,
        DibsCheckout $dibsCheckout,
        DibsCheckoutCOntext $dibsCheckoutContext,
        Logger $logger,
        QuoteCollectionFactory $quoteCollectionFactory,
        OrderCollectionFactory $orderCollectionFactory
    ) {
        $this->logger = $logger;
        $this->quoteCollectionFactory = $quoteCollectionFactory;
        $this->orderCollectionFactory = $orderCollectionFactory;

        parent::__construct(
            $context,
            $customerSession,
            $customerRepository,
            $accountManagement,
            $checkoutSession,
            $storeManager,
            $resultPageFactory,
            $dibsCheckout,
            $dibsCheckoutContext
        );
    }

    public function execute()
    {
        $this->logger->info('Webhook body: ' . $this->getRequest()->getContent());
        $data = json_decode($this->getRequest()->getContent(), true);
        $paymentId = null;
        $checkout = $this->getDibsCheckout();
        $checkout->setCheckoutContext($this->dibsCheckoutContext);

        if (isset($data['event']) && $data['event'] === CreatePaymentWebhook::EVENT_PAYMENT_CHECKOUT_COMPLETED) {
            $paymentId = $data['data']['paymentId'] ?? null;

            $orderCollection = $this->orderCollectionFactory->create();
            $ordersCount = $orderCollection
                ->addFieldToFilter('dibs_payment_id', ['eq' => $paymentId])
                ->load()
                ->count();

            if ($paymentId && $ordersCount === 0) {
                $quoteCollection = $this->quoteCollectionFactory->create();
                $quotes = $quoteCollection
                    ->addFieldToFilter('dibs_payment_id', ['eq' => $paymentId])
                    ->load()
                    ->getItems();

                /** @var Quote $quote */
                $quote = array_shift($quotes);
                try {
                    $payment = $checkout->getDibsPaymentHandler()->loadDibsPaymentById($paymentId);
                } catch (\Exception $e) {
                    $this->logger->error("Trying to create a new payment because we could not Update Dibs Checkout Payment for ID: {$paymentId}, Error: {$e->getMessage()} (see exception.log)");
                    $this->logger->error($e);
                }

                if ($payment && $quote) {
                    try {
                        $checkout->placeOrder($payment, $quote);
                    } catch (\Exception $e) {
                        $this->logger->error("Could not place order for dibs payment with payment id: " . $payment->getPaymentId() . ", Quote ID:" . $quote->getId());
                        $this->logger->error("Error message:" . $e->getMessage());
                    }
                }
            }
        }
    }
}