#include <iostream>
#include <string>
#include <vector>
#include <iomanip>
#include <random>
#include <chrono>
using namespace std;

class BillingStrategy;
class Customer;


class BillingStrategy {
public:
    virtual ~BillingStrategy() {}
    virtual double calculateCharge(double usage) const = 0;
    virtual string getStrategyName() const = 0;
};

class FlatRateBilling : public BillingStrategy {
private:
    double rate;
public:
    FlatRateBilling(double r) : rate(r) {}
    
    double calculateCharge(double usage) const {
        return usage * rate;
    }
    
    string getStrategyName() const {
        return "Flat Rate";
    }
};


class TieredBilling : public BillingStrategy {
public:
    double calculateCharge(double usage) const {
        double charge = 0.0;
        

        if (usage <= 100) {
            charge = usage * 0.10;
        }

        else if (usage <= 500) {
            charge = (100 * 0.10) + ((usage - 100) * 0.08);
        }

        else {
            charge = (100 * 0.10) + (400 * 0.08) + ((usage - 500) * 0.05);
        }
        
        return charge;
    }
    
    string getStrategyName() const {
        return "Tiered Pricing";
    }
};


class Discount {
public:
    virtual ~Discount() {}
    virtual double apply(double charge) const = 0;
    virtual string getDescription() const = 0;
};

class PercentageDiscount : public Discount {
private:
    double percentage;
    string reason;
public:
    PercentageDiscount(double pct, const string& r) 
        : percentage(pct), reason(r) {}
    
    double apply(double charge) const {
        return charge * (1.0 - percentage / 100.0);
    }
    
    string getDescription() const {
        return reason;
    }
};


class Transaction {
private:
    double usage;
    string description;
public:
    Transaction(double u, const string& desc) 
        : usage(u), description(desc) {}
    
    double getUsage() const { return usage; }
    string getDescription() const { return description; }
};

class Customer {
private:
    static const int MAX_TRANSACTIONS = 100;
    static const int MAX_DISCOUNTS = 10;
    
    int id;
    string name;
    string email;
    BillingStrategy* billingStrategy;
    Transaction* transactions[MAX_TRANSACTIONS];
    int transactionCount;
    Discount* discounts[MAX_DISCOUNTS];
    int discountCount;
    
public:
    Customer(int customerId, const string& customerName, 
             const string& customerEmail, BillingStrategy* strategy)
        : id(customerId), name(customerName), email(customerEmail), 
          billingStrategy(strategy), transactionCount(0), discountCount(0) {

        for (int i = 0; i < MAX_TRANSACTIONS; i++) {
            transactions[i] = NULL;
        }
        for (int i = 0; i < MAX_DISCOUNTS; i++) {
            discounts[i] = NULL;
        }
    }
    
    ~Customer() {

        for (int i = 0; i < transactionCount; i++) {
            delete transactions[i];
        }
        for (int i = 0; i < discountCount; i++) {
            delete discounts[i];
        }
        delete billingStrategy;
    }
    
    bool addTransaction(double usage, const string& description) {

        if (transactionCount >= MAX_TRANSACTIONS) {
            cout << "Transaction limit reached!\n";
            return false;
        }
        
        transactions[transactionCount++] = new Transaction(usage, description);
        return true;
    }
    
    bool addDiscount(Discount* discount) {
        if (discountCount >= MAX_DISCOUNTS) {
            cout << "Discount limit reached!\n";
            return false;
        }
        
        discounts[discountCount++] = discount;
        return true;
    }

    double getTotalUsage() const {
        double total = 0.0;
        for (int i = 0; i < transactionCount; i++) {
            total += transactions[i]->getUsage();
        }
        return total;
    }

    double calculateBill() const {
        double totalUsage = getTotalUsage();
        double charge = billingStrategy->calculateCharge(totalUsage);

        for (int i = 0; i < discountCount; i++) {
            charge = discounts[i]->apply(charge);
        }
        
        return charge;
    }

    int getId() const { return id; }
    string getName() const { return name; }
    string getEmail() const { return email; }
    int getTransactionCount() const { return transactionCount; }
    Transaction* getTransaction(int index) const { 
        return (index < transactionCount) ? transactions[index] : NULL; 
    }
    int getDiscountCount() const { return discountCount; }
    Discount* getDiscount(int index) const {
        return (index < discountCount) ? discounts[index] : NULL;
    }
    string getBillingStrategyName() const { 
        return billingStrategy->getStrategyName(); 
    }
};


class Invoice {
private:
    Customer* customer;
    double totalAmount;
public:
    Invoice(Customer* cust) : customer(cust) {
        totalAmount = customer->calculateBill();
    }
    
    void print() const {

        cout << "  INVOICE\n";

        cout << "Customer ID: " << customer->getId() << "\n";
        cout << "Name: " << customer->getName() << "\n";
        cout << "Email: " << customer->getEmail() << "\n";
        cout << "Plan: " << customer->getBillingStrategyName() << "\n";

        
        cout << "\nTransactions:\n";
        double totalUsage = 0.0;
        for (int i = 0; i < customer->getTransactionCount(); i++) {
            Transaction* trans = customer->getTransaction(i);
            cout << "  " << trans->getDescription() 
                 << ": " << trans->getUsage() << " units\n";
            totalUsage += trans->getUsage();
        }
        

        cout << "Total Usage: " << totalUsage << " units\n\n";
        
        // Show discounts
        if (customer->getDiscountCount() > 0) {
            cout << "Discounts:\n";
            for (int i = 0; i < customer->getDiscountCount(); i++) {
                Discount* disc = customer->getDiscount(i);
                cout << "  - " << disc->getDescription() << "\n";
            }
            cout << "\n";
        }

        cout << "TOTAL: $" << totalAmount << "\n";
        
    }
};


class BillingSystem {
private:
    static const int MAX_CUSTOMERS = 1000;
    Customer* customers[MAX_CUSTOMERS];
    int customerCount;
    int nextCustomerId;
    
public:
    BillingSystem() : customerCount(0), nextCustomerId(1001) {
        for (int i = 0; i < MAX_CUSTOMERS; i++) {
            customers[i] = NULL;
        }
    }
    
    ~BillingSystem() {
        // Clean up all customers
        for (int i = 0; i < customerCount; i++) {
            delete customers[i];
        }
    }

    int addCustomer(const string& name, const string& email,
                    BillingStrategy* strategy) {
        if (customerCount >= MAX_CUSTOMERS) {
            cout << "Customer limit reached!\n";
            return -1;
        }
        
        int id = nextCustomerId++;
        customers[customerCount++] = new Customer(id, name, email, strategy);
        cout << "Customer added: " << name << " (ID: " << id << ")\n";
        return id;
    }
    
    Customer* findCustomer(int customerId) {
        for (int i = 0; i < customerCount; i++) {
            if (customers[i]->getId() == customerId) {
                return customers[i];
            }
        }
        return NULL;
    }
    
    bool addTransaction(int customerId, double usage, const string& description) {
        Customer* customer = findCustomer(customerId);
        if (customer == NULL) {
            cout << "Customer not found!\n";
            return false;
        }
        
        return customer->addTransaction(usage, description);
    }
    
    bool applyDiscount(int customerId, Discount* discount) {
        Customer* customer = findCustomer(customerId);
        if (customer == NULL) {
            cout << "Customer not found!\n";
            delete discount; 
            return false;
        }
        
        return customer->addDiscount(discount);
    }
    
    void generateInvoice(int customerId) {
        Customer* customer = findCustomer(customerId);
        if (customer == NULL) {
            cout << "Customer not found!\n";
            return;
        }
        
        Invoice invoice(customer);
        invoice.print();
    }
    
    void listCustomers() const {
      
        cout << "All Customers (" << customerCount << "):\n";
        
        
        for (int i = 0; i < customerCount; i++) {
            cout << "ID: " << customers[i]->getId() 
                 << " | " << customers[i]->getName() << "\n";
        }
       
    }
    
    int getCustomerCount() const { return customerCount; }
};


static double generateRandomUsage() {
    static std::random_device rd;
    static std::mt19937 gen(rd());
    static std::uniform_real_distribution<> distrib(10.0, 1000.0);
    return distrib(gen);
}

static double generateRandomRate() {
    static std::random_device rd;
    static std::mt19937 gen(rd());
    static std::uniform_real_distribution<> distrib(0.05, 0.50);
    return distrib(gen);
}

void runLoadTest(BillingSystem& system, int numCustomers, int transactionsPerCustomer) {
    cout << "\n=== Running Load Test for " << numCustomers << " Customers ===\n";
    cout << "Total Transactions to process: " << (long long)numCustomers * transactionsPerCustomer << "\n";

    auto start_setup = std::chrono::high_resolution_clock::now();
    vector<int> customerIds;
    customerIds.reserve(numCustomers);

    for (int i = 0; i < numCustomers; ++i) {
        string name = "LoadTest Cust " + to_string(i + 1);
        string email = "load" + to_string(i + 1) + "@test.local";
        BillingStrategy* strategy = nullptr;

        // alternate between FlatRate and Tiered to exercise polymorphism
        if (i % 2 == 0) {
            strategy = new FlatRateBilling(generateRandomRate());
        } else {
            strategy = new TieredBilling();
        }

        int id = system.addCustomer(name, email, strategy);
        if (id != -1) {
            customerIds.push_back(id);
        }

        Customer* cust = system.findCustomer(id);
        if (cust) {
            for (int t = 0; t < transactionsPerCustomer; ++t) {
                double usage = generateRandomUsage();
                string desc = "Tx " + to_string(t + 1);
                cust->addTransaction(usage, desc);
            }
            // apply small percentage discount for half of customers
            if (i % 2 == 0) {
                cust->addDiscount(new PercentageDiscount(5.0, "LoadTest 5%"));
            }
        }
    }

    auto end_setup = std::chrono::high_resolution_clock::now();
    std::chrono::duration<double, std::milli> setup_duration = end_setup - start_setup;
    cout << "Setup Phase complete in: " << setup_duration.count() << " ms\n";

    cout << "\nStarting invoice calculations for " << customerIds.size() << " customers...\n";
    auto start_invoice = std::chrono::high_resolution_clock::now();

    double totalSystemCharge = 0.0;
    for (int id : customerIds) {
        Customer* cust = system.findCustomer(id);
        if (cust) {
            double bill = cust->calculateBill();
            totalSystemCharge += bill;
        }
    }

    auto end_invoice = std::chrono::high_resolution_clock::now();
    std::chrono::duration<double, std::milli> invoice_duration = end_invoice - start_invoice;

    cout << fixed << setprecision(2);
    cout << "\n--- Load Test Results ---\n";
    cout << "Total final charge across all customers: $" << totalSystemCharge << "\n";
    cout << "Billing calculation time: " << invoice_duration.count() << " ms\n";
    if (!customerIds.empty()) {
        cout << "Average time per customer: " << (invoice_duration.count() / customerIds.size()) << " ms\n";
    }
    cout << "Test Complete.\n";
}


int main() {
    BillingSystem system;

    while (true) {
        cout << "\n========================================\n";
        cout << "         BILLING SYSTEM - MAIN MENU     \n";
        cout << "========================================\n";
        cout << "Customers in system: " << system.getCustomerCount() << "\n\n";
        cout << "1) Add customer\n";
        cout << "2) Add transaction\n";
        cout << "3) Apply percentage discount\n";
        cout << "4) Generate & print invoice\n";
        cout << "5) List customers (brief)\n";
        cout << "6) Show customer summary\n";
        cout << "7) Run load test\n";
        cout << "8) Exit\n";
        cout << "Enter choice [1-8]: ";

        int choice;
        if (!(cin >> choice)) {
            cin.clear();
            cin.ignore(1000, '\n');
            cout << "Invalid input. Please enter a number between 1 and 8.\n";
            continue;
        }
        cin.ignore(1000, '\n'); // consume newline

        if (choice == 1) {
            string name, email;
            cout << "Enter customer name: ";
            getline(cin, name);
            cout << "Enter customer email: ";
            getline(cin, email);

            cout << "Select plan: 1) Flat Rate  2) Tiered\n";
            cout << "Enter plan number: ";
            int plan;
            if (!(cin >> plan)) {
                cin.clear();
                cin.ignore(1000, '\n');
                cout << "Invalid plan choice.\n";
                continue;
            }
            cin.ignore(1000, '\n');

            if (plan == 1) {
                cout << "Enter flat rate (per unit), e.g. 0.15: ";
                double rate;
                if (!(cin >> rate)) {
                    cin.clear();
                    cin.ignore(1000, '\n');
                    cout << "Invalid rate.\n";
                    continue;
                }
                cin.ignore(1000, '\n');
                system.addCustomer(name, email, new FlatRateBilling(rate));
            } else if (plan == 2) {
                system.addCustomer(name, email, new TieredBilling());
            } else {
                cout << "Unknown plan.\n";
            }
        }
        else if (choice == 2) {
            cout << "Enter customer ID: ";
            int id;
            if (!(cin >> id)) { cin.clear(); cin.ignore(1000,'\n'); cout << "Invalid ID.\n"; continue; }
            cout << "Enter usage (units): ";
            double usage;
            if (!(cin >> usage)) { cin.clear(); cin.ignore(1000,'\n'); cout << "Invalid usage.\n"; continue; }
            cin.ignore(1000,'\n');
            cout << "Enter description: ";
            string desc;
            getline(cin, desc);
            if (system.addTransaction(id, usage, desc)) {
                cout << "Transaction added.\n";
            }
        }
        else if (choice == 3) {
            cout << "Enter customer ID: ";
            int id;
            if (!(cin >> id)) { cin.clear(); cin.ignore(1000,'\n'); cout << "Invalid ID.\n"; continue; }
            cout << "Enter discount percentage (e.g. 10 for 10%): ";
            double pct;
            if (!(cin >> pct)) { cin.clear(); cin.ignore(1000,'\n'); cout << "Invalid percentage.\n"; continue; }
            cin.ignore(1000,'\n');
            cout << "Enter discount description: ";
            string reason;
            getline(cin, reason);
            if (system.applyDiscount(id, new PercentageDiscount(pct, reason))) {
                cout << "Discount applied.\n";
            }
        }
        else if (choice == 4) {
            cout << "Enter customer ID to generate invoice: ";
            int id;
            if (!(cin >> id)) { cin.clear(); cin.ignore(1000,'\n'); cout << "Invalid ID.\n"; continue; }
            cin.ignore(1000,'\n');
            system.generateInvoice(id);
        }
        else if (choice == 5) {
            system.listCustomers();
        }
        else if (choice == 6) {
            cout << "Enter customer ID for summary: ";
            int id;
            if (!(cin >> id)) { cin.clear(); cin.ignore(1000,'\n'); cout << "Invalid ID.\n"; continue; }
            cin.ignore(1000,'\n');
            Customer* c = system.findCustomer(id);
            if (!c) { cout << "Customer not found.\n"; continue; }
            cout << "\n--- Customer Summary ---\n";
            cout << "ID: " << c->getId() << "\n";
            cout << "Name: " << c->getName() << "\n";
            cout << "Email: " << c->getEmail() << "\n";
            cout << "Plan: " << c->getBillingStrategyName() << "\n";
            cout << "Transactions: " << c->getTransactionCount() << "\n";
            cout << "Discounts: " << c->getDiscountCount() << "\n";
            cout << "Total usage: " << c->getTotalUsage() << " units\n";
            cout << "Current bill (calculated): $" << fixed << setprecision(2) << c->calculateBill() << "\n";
        }
        else if (choice == 7) {
            cout << "Enter number of customers for load test (e.g. 500): ";
            int nc;
            if (!(cin >> nc) || nc <= 0) { cin.clear(); cin.ignore(1000,'\n'); cout << "Invalid number.\n"; continue; }
            cout << "Enter transactions per customer (e.g. 5): ";
            int tx;
            if (!(cin >> tx) || tx < 0) { cin.clear(); cin.ignore(1000,'\n'); cout << "Invalid number.\n"; continue; }
            cin.ignore(1000,'\n');
            runLoadTest(system, nc, tx);
        }
        else if (choice == 8) {
            cout << "Exiting.\n";
            break;
        }
        else {
            cout << "Unknown choice. Please enter a number between 1 and 8.\n";
        }
    }

    return 0;
}