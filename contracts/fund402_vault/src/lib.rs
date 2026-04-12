#![no_std]
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, token, Address, Env, String, Symbol,
};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum ContractError {
    AlreadyInitialized = 1,
    InsufficientBalance = 2,
    InsufficientCollateral = 3,
    NotYourLoan = 4,
    AdminOnly = 5,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Admin,
    UsdcToken,
    PriceFeed,
    LpBalance(Address),
    TotalLiquidity,
    TotalBorrowed,
    TotalLoans,
    VaultPrice(String), // vault_id -> price_usdc
    Loan(u64),
    XlmPrice,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Loan {
    pub agent: Address,
    pub merchant: Address,
    pub amount_borrowed: i128,
    pub collateral_locked: i128,
    pub timestamp: u64,
}

#[contracttype]
pub struct BorrowResult {
    pub loan_id: u64,
    pub amount_borrowed: i128,
    pub collateral_locked: i128,
    pub merchant: Address,
}

#[contracttype]
pub struct SimulateBorrowResult {
    pub required_collateral_xlm: i128,
    pub current_price: i128,
    pub fee: i128,
    pub net_to_merchant: i128,
}

#[contracttype]
pub struct PoolStats {
    pub total_liquidity: i128,
    pub total_borrowed: i128,
    pub total_loans: u64,
    pub apy_basis_points: u32,
    pub utilization_rate: u32,
}

#[contract]
pub struct Fund402Vault;

#[contractimpl]
impl Fund402Vault {
    pub fn initialize(env: Env, admin: Address, usdc_token: Address, price_feed: Address) -> Result<(), ContractError> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(ContractError::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::UsdcToken, &usdc_token);
        env.storage().instance().set(&DataKey::PriceFeed, &price_feed);
        env.storage().instance().set(&DataKey::TotalLiquidity, &0i128);
        env.storage().instance().set(&DataKey::TotalBorrowed, &0i128);
        env.storage().instance().set(&DataKey::TotalLoans, &0u64);
        env.storage().instance().set(&DataKey::XlmPrice, &1200000i128); // Initial price: 0.12 USDC/XLM
        Ok(())
    }

    pub fn set_price(env: Env, admin: Address, price: i128) -> Result<(), ContractError> {
        admin.require_auth();
        let stored_admin = env.storage().instance().get::<_, Address>(&DataKey::Admin).unwrap();
        if admin != stored_admin {
            return Err(ContractError::AdminOnly);
        }
        env.storage().instance().set(&DataKey::XlmPrice, &price);
        Ok(())
    }

    pub fn get_price(env: Env) -> i128 {
        env.storage().instance().get::<_, i128>(&DataKey::XlmPrice).unwrap_or(1200000)
    }

    pub fn deposit_liquidity(env: Env, lp: Address, amount: i128) -> Result<(), ContractError> {
        lp.require_auth();
        let usdc_token = env.storage().instance().get::<_, Address>(&DataKey::UsdcToken).unwrap();
        let client = token::Client::new(&env, &usdc_token);
        client.transfer(&lp, &env.current_contract_address(), &amount);

        let mut lp_balance = env.storage().instance().get::<_, i128>(&DataKey::LpBalance(lp.clone())).unwrap_or(0);
        lp_balance += amount;
        env.storage().instance().set(&DataKey::LpBalance(lp), &lp_balance);

        let mut total_liquidity = env.storage().instance().get::<_, i128>(&DataKey::TotalLiquidity).unwrap();
        total_liquidity += amount;
        env.storage().instance().set(&DataKey::TotalLiquidity, &total_liquidity);
        Ok(())
    }

    pub fn withdraw_liquidity(env: Env, lp: Address, amount: i128) -> Result<(), ContractError> {
        lp.require_auth();
        let mut lp_balance = env.storage().instance().get::<_, i128>(&DataKey::LpBalance(lp.clone())).unwrap_or(0);
        if lp_balance < amount {
            return Err(ContractError::InsufficientBalance);
        }
        lp_balance -= amount;
        env.storage().instance().set(&DataKey::LpBalance(lp.clone()), &lp_balance);

        let mut total_liquidity = env.storage().instance().get::<_, i128>(&DataKey::TotalLiquidity).unwrap();
        total_liquidity -= amount;
        env.storage().instance().set(&DataKey::TotalLiquidity, &total_liquidity);

        let usdc_token = env.storage().instance().get::<_, Address>(&DataKey::UsdcToken).unwrap();
        let client = token::Client::new(&env, &usdc_token);
        client.transfer(&env.current_contract_address(), &lp, &amount);
        Ok(())
    }

    pub fn get_lp_balance(env: Env, lp: Address) -> i128 {
        env.storage().instance().get::<_, i128>(&DataKey::LpBalance(lp)).unwrap_or(0)
    }

    pub fn simulate_borrow(env: Env, usdc_amount: i128) -> SimulateBorrowResult {
        let price = Self::get_price(env.clone());
        // USDC has 7 decimals, XLM has 7
        // 150% collateral ratio. collateral (XLM) = (usdc_amount * 1.5) / xlm_price
        let required_collateral_xlm = (usdc_amount * 150 * 10_000_000) / (price * 100);
        
        SimulateBorrowResult {
            required_collateral_xlm,
            current_price: price,
            fee: 0,
            net_to_merchant: usdc_amount,
        }
    }

    pub fn borrow_and_pay(
        env: Env,
        agent: Address,
        merchant: Address,
        usdc_amount: i128,
        xlm_collateral: i128,
        _vault_id: String,
    ) -> Result<BorrowResult, ContractError> {
        agent.require_auth();
        
        let simulation = Self::simulate_borrow(env.clone(), usdc_amount);
        if xlm_collateral < simulation.required_collateral_xlm {
            return Err(ContractError::InsufficientCollateral);
        }

        // Lock XLM collateral from agent
        // In this implementation, we use the "native" XLM token contract via the environment
        // For simplicity in hackathon, we assume XLM is sent to this contract address
        // and locked in instance storage or just held in the contract account.

        // Transfer USDC to merchant
        let usdc_token = env.storage().instance().get::<_, Address>(&DataKey::UsdcToken).unwrap();
        let usdc_client = token::Client::new(&env, &usdc_token);
        usdc_client.transfer(&env.current_contract_address(), &merchant, &usdc_amount);

        let mut total_loans = env.storage().instance().get::<_, u64>(&DataKey::TotalLoans).unwrap();
        let loan_id = total_loans;
        total_loans += 1;
        env.storage().instance().set(&DataKey::TotalLoans, &total_loans);

        let loan = Loan {
            agent: agent.clone(),
            merchant: merchant.clone(),
            amount_borrowed: usdc_amount,
            collateral_locked: xlm_collateral,
            timestamp: env.ledger().timestamp(),
        };
        env.storage().instance().set(&DataKey::Loan(loan_id), &loan);

        let mut total_borrowed = env.storage().instance().get::<_, i128>(&DataKey::TotalBorrowed).unwrap();
        total_borrowed += usdc_amount;
        env.storage().instance().set(&DataKey::TotalBorrowed, &total_borrowed);

        Ok(BorrowResult {
            loan_id,
            amount_borrowed: usdc_amount,
            collateral_locked: xlm_collateral,
            merchant,
        })
    }

    pub fn repay_loan(env: Env, agent: Address, loan_id: u64) -> Result<(), ContractError> {
        agent.require_auth();
        let loan = env.storage().instance().get::<_, Loan>(&DataKey::Loan(loan_id)).unwrap();
        if loan.agent != agent {
            return Err(ContractError::NotYourLoan);
        }

        let usdc_token = env.storage().instance().get::<_, Address>(&DataKey::UsdcToken).unwrap();
        let client = token::Client::new(&env, &usdc_token);
        client.transfer(&agent, &env.current_contract_address(), &loan.amount_borrowed);

        let mut total_borrowed = env.storage().instance().get::<_, i128>(&DataKey::TotalBorrowed).unwrap();
        total_borrowed -= loan.amount_borrowed;
        env.storage().instance().set(&DataKey::TotalBorrowed, &total_borrowed);

        env.storage().instance().remove(&DataKey::Loan(loan_id));
        Ok(())
    }

    pub fn get_pool_stats(env: Env) -> PoolStats {
        let total_liquidity = env.storage().instance().get::<_, i128>(&DataKey::TotalLiquidity).unwrap_or(0);
        let total_borrowed = env.storage().instance().get::<_, i128>(&DataKey::TotalBorrowed).unwrap_or(0);
        let total_loans = env.storage().instance().get::<_, u64>(&DataKey::TotalLoans).unwrap_or(0);

        let utilization_rate = if total_liquidity > 0 {
            ((total_borrowed * 10000) / total_liquidity) as u32
        } else {
            0
        };

        PoolStats {
            total_liquidity,
            total_borrowed,
            total_loans,
            apy_basis_points: 200,
            utilization_rate,
        }
    }
}
