#![cfg_attr(not(feature = "std"), no_std, no_main)]

extern crate alloc;

#[ink::contract]
mod phatbot_controller {
    use ink::env::{
        call::{build_call, ExecutionInput, Selector},
        DefaultEnvironment,
    };
    use primitive_types::{H160, H256, U256};
    use scale::{Decode, Encode};

    #[ink(storage)]
    pub struct PhatbotController {
        owner: AccountId,
    }

    #[derive(Encode, Decode)]
    #[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
    pub enum Error {
        FailedToGetEvmAddress,
        FailedToMint,
    }

    pub type Result<T> = core::result::Result<T, Error>;

    impl PhatbotController {
        #[ink(constructor)]
        pub fn new() -> Self {
            Self {
                owner: Self::env().caller(),
            }
        }

        #[ink(message)]
        pub fn get_evm_account_address(&self, phatbot_profile: AccountId) -> Result<H160> {
            let from_address = build_call::<DefaultEnvironment>()
                .call(phatbot_profile)
                .transferred_value(0)
                .exec_input(ExecutionInput::new(Selector::new(ink::selector_bytes!(
                    "get_evm_account_address"
                ))))
                .returns::<phatbot_profile::Result<H160>>()
                .invoke()
                .map_err(|_| Error::FailedToGetEvmAddress)?;
            Ok(from_address)
        }

        #[ink(message)]
        pub fn mint(&self, phatbot_profile: AccountId, gas: U256) -> Result<H256> {
            let tx_id = build_call::<DefaultEnvironment>()
                .call(phatbot_profile)
                .transferred_value(0)
                .exec_input(
                    ExecutionInput::new(Selector::new(ink::selector_bytes!("mint"))).push_arg(gas),
                )
                .returns::<phatbot_profile::Result<H256>>()
                .invoke()
                .map_err(|_| Error::FailedToMint)?;
            Ok(tx_id)
        }
    }

    #[cfg(test)]
    mod tests {
        #[ink::test]
        fn it_works() {}
    }
}
