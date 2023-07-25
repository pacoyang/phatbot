#![cfg_attr(not(feature = "std"), no_std, no_main)]

extern crate alloc;

#[ink::contract]
mod phatbot_controller {
    use alloc::{format, string::String};
    use ink::env::{
        call::{build_call, ExecutionInput, Selector},
        DefaultEnvironment,
    };
    use pink_extension::http_post;
    use primitive_types::{H160, H256, U256};
    use scale::{Decode, Encode};

    #[ink(storage)]
    pub struct PhatbotController {
        owner: AccountId,
        notify_endpoint: Option<String>,
    }

    #[derive(Encode, Decode)]
    #[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
    pub enum Error {
        BadOrigin,
        HttpRequestFailed,
        FailedToGetEvmAddress,
        FailedToMint,
    }

    pub type Result<T> = core::result::Result<T, Error>;

    impl PhatbotController {
        #[ink(constructor)]
        pub fn new(notify_endpoint: Option<String>) -> Self {
            Self {
                owner: Self::env().caller(),
                notify_endpoint,
            }
        }

        #[ink(message)]
        pub fn get_notify_endpoint(&self) -> Option<String> {
            self.notify_endpoint.clone()
        }

        #[ink(message)]
        pub fn set_notify_endpoint(&mut self, notify_endpoint: String) -> Result<()> {
            self.ensure_owner()?;
            self.notify_endpoint = Some(notify_endpoint);
            Ok(())
        }

        #[ink(message)]
        pub fn notify_all(&self, text: String) -> Result<u16> {
            self.ensure_owner()?;
            let url = format!("{}/api/notify_all", self.notify_endpoint.clone().unwrap_or(String::from("")));
            let resp = http_post!(url, text.as_bytes().to_vec());
            Ok(resp.status_code)
        }

        #[ink(message)]
        pub fn notify(&self, tg_id: String, text: String) -> Result<u16> {
            self.ensure_owner()?;
            let url = format!("{}/api/notify/{}", self.notify_endpoint.clone().unwrap_or(String::from("")), tg_id);
            let resp = http_post!(url, text.as_bytes().to_vec());
            Ok(resp.status_code)
        }

        #[ink(message)]
        pub fn get_evm_account_address(&self, phatbot_profile: AccountId) -> Result<H160> {
            self.ensure_owner()?;
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
            self.ensure_owner()?;
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

        fn ensure_owner(&self) -> Result<()> {
            if self.env().caller() == self.owner {
                Ok(())
            } else {
                Err(Error::BadOrigin)
            }
        }
    }

    #[cfg(test)]
    mod tests {
        #[ink::test]
        fn it_works() {}
    }
}
