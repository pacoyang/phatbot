'use client'
import type {
  InjectedWindowProvider,
  InjectedAccountWithMeta,
} from '@polkadot/extension-inject/types'
import { useCallback, useEffect, useState } from 'react'
import type { PropsWithChildren } from 'react'
import { useAtom, atom, useAtomValue, useSetAtom } from 'jotai'
import { atomWithStorage, RESET } from 'jotai/utils'
import { ApiPromise, WsProvider } from '@polkadot/api'
import { Keyring } from '@polkadot/ui-keyring'
import { decodeAddress } from '@polkadot/util-crypto'
import { fromPairs, path, find, map, toPairs, propOr } from 'ramda'
import {
  ChakraProvider,
  Button,
  Avatar,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  Stack,
  Spinner,
} from '@chakra-ui/react'
import { BsArrowRight, BsDownload } from 'react-icons/bs'
import {
  options,
  OnChainRegistry,
  PinkBlueprintPromise,
  signCertificate,
} from '@phala/sdk'

import contract from '../../../phatbot_profile.json'
import signAndSend from './signAndSend'

export interface InjectedAccountWithMetaAndName
  extends InjectedAccountWithMeta {
  name: string
}

export const accountsLoadingAtom = atom(false)
export const availableAccountsAtom = atom<InjectedAccountWithMetaAndName[]>([])
export const lastSelectedWeb3ProviderAtom = atomWithStorage(
  'last-selected-web-provider',
  ''
)
export const lastSelectedAccountAddressAtom = atomWithStorage(
  'last-selected-account-address',
  ''
)
export const selectedWeb3ProviderAtom = atom('')

const keyringInternalAtom = atom<Keyring | null>(null)
export const keyringInstanceAtom = atom(
  (get) => get(keyringInternalAtom),
  async (get, set, action) => {
    const instance = get(keyringInternalAtom)
    if (action === RESET && !instance) {
      const keyring = new Keyring()
      keyring.loadAll({ isDevelopment: false })
      set(keyringInternalAtom, keyring)
    }
  }
)

const getAllAcountsForProvider = async (name: string, keyring: Keyring) => {
  await new Promise((resolve) => setTimeout(resolve, 2000))
  const provider: InjectedWindowProvider | undefined = path(
    ['injectedWeb3', name],
    window
  )
  if (provider && provider.enable) {
    try {
      const gateway = await provider.enable('PhatBot')
      const accounts = await gateway.accounts.get(true)
      return accounts.map(
        (acc) =>
          ({
            ...acc,
            address: keyring.encodeAddress(decodeAddress(acc.address), 30),
            meta: {
              source: name,
            },
          } as InjectedAccountWithMetaAndName)
      )
    } catch (err) {
      console.error(err)
    }
  }
  return []
}

export const currentAccountAtom = atom(
  (get) => {
    const accounts = get(availableAccountsAtom)
    return accounts.find(
      (account) => account.address === get(lastSelectedAccountAddressAtom)
    )
  },
  async (
    get,
    set,
    account: InjectedAccountWithMetaAndName | typeof RESET | null
  ) => {
    if (account === RESET) {
      const name = get(lastSelectedWeb3ProviderAtom)
      const accounts = await getAllAcountsForProvider(
        name,
        get(keyringInstanceAtom)!
      )
      set(availableAccountsAtom, accounts)
      const lastSelectedAddress = get(lastSelectedAccountAddressAtom)
      set(selectedWeb3ProviderAtom, name)
      const found = find((acc) => acc.address === lastSelectedAddress, accounts)
    } else if (account === null) {
      set(lastSelectedAccountAddressAtom, '')
    } else {
      await new Promise((r) => setTimeout(r, 1))
      set(lastSelectedWeb3ProviderAtom, get(selectedWeb3ProviderAtom))
      await new Promise((r) => setTimeout(r, 1))
      set(lastSelectedAccountAddressAtom, account.address)
    }
  }
)

export const currentProfileAtom = atom((get) => {
  const currentAccount = get(currentAccountAtom)
  if (!currentAccount) {
    return {
      displayName: 'Guest',
      connected: false,
    }
  }
  let displayName = propOr('', 'name', currentAccount) as string
  if (!displayName) {
    displayName = currentAccount.address
  }
  return {
    ...currentAccount,
    displayName,
    connected: true,
  }
})

export const walletSelectModalVisibleAtom = atom(false)
export const accountSelectModalVisibleAtom = atom(false)

export const signerAtom = atom(async (get) => {
  if (typeof window === 'undefined') {
    return
  }
  const name = get(lastSelectedWeb3ProviderAtom)
  const provider: InjectedWindowProvider | undefined = path(
    ['injectedWeb3', name],
    window
  )
  if (provider && provider.enable) {
    try {
      const gateway = await provider.enable('PhatBot')
      return gateway.signer
    } catch (error) {
      console.error(error)
    }
  }
})

export function Section({ tg_id, token }: { tg_id: number, token: string }) {
  useRestoreLastSelectedAccount()
  const profile = useAtomValue(currentProfileAtom)
  const setWalletSelectModalVisible = useSetAtom(walletSelectModalVisibleAtom)

  const currentAccount = useAtomValue(currentAccountAtom)
  const [isLoading, setIsLoading] = useState(false)
  const signer = useAtomValue(signerAtom)
  const account = useAtomValue(currentAccountAtom)
  const [evmAddress, setEvmAddress] = useState('')

  const handleCreate = async () => {
    if (!currentAccount || !account || !signer) {
      return
    }
    setIsLoading(true)
    try {
      const api = await ApiPromise.create(
        options({
          provider: new WsProvider('wss://poc5.phala.network/ws'),
          noInitWarn: true,
        })
      )
      const phatRegistry = await OnChainRegistry.create(api)
      const blueprint = new PinkBlueprintPromise(
        phatRegistry.api,
        phatRegistry,
        contract,
        contract.source.hash
      )
      const cert = await signCertificate({ signer, account, api })
      console.info(cert, process.env.NEXT_PUBLIC_CONTROLLER_ACCOUNT_ID)
      const { gasRequired, storageDeposit } = await blueprint.query.new(
        account.address,
        { cert },
        tg_id,
        process.env.NEXT_PUBLIC_CONTROLLER_ACCOUNT_ID,
      )
      console.info(gasRequired, storageDeposit)
      // @ts-ignore
      const { result: instantiateResult } = await signAndSend(
        blueprint.tx.new(
          {
            // @ts-ignore
            gasLimit: gasRequired.refTime,
            storageDepositLimit: storageDeposit.isCharge
              ? storageDeposit.asCharge
              : null,
          },
          tg_id,
          process.env.NEXT_PUBLIC_CONTROLLER_ACCOUNT_ID,
        ),
        currentAccount.address,
        signer
      )
      await instantiateResult.waitFinalized()
      const { contractId } = instantiateResult
      const res = await fetch('/api/bind', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token, contractId }),
      })
      const data = await res.json()
      if (data.address) {
        setEvmAddress(data.address)
        alert('Successfully created!')
      }
    } catch (error: any) {
      console.error(error)
      alert('Fail to create.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <ChakraProvider>
      <section className="flex flex-col gap-6 w-full">
        <Button onClick={() => setWalletSelectModalVisible(true)}>
          {!profile.connected
            ? 'Connect Wallet'
            : `Current Account: ${profile.displayName}`}
        </Button>
        {profile.connected && !evmAddress ? (
          <Button
            colorScheme="telegram"
            onClick={handleCreate}
            isLoading={isLoading}
          >
            Create EVM Wallet
          </Button>
        ) : null}
        {
          evmAddress ? (
            <div>Your wallet address: {evmAddress}</div>
          ) : null
        }
      </section>
      <WalletSelectModal />
      <AccountSelectModal />
    </ChakraProvider>
  )
}

type Pairs<T1, T2 = T1> = [T1, T2]
export const availableWeb3ProvidersAtom = atom<Pairs<string>[]>([])

function getInjectedWeb3Provider() {
  const result = map<[string, InjectedWindowProvider], Pairs<string>>(
    ([k, v]) => [k, v.version || 'unknown'],
    toPairs(propOr({}, 'injectedWeb3', window) as object)
  )
  return result
}

availableWeb3ProvidersAtom.onMount = (set) => {
  set(getInjectedWeb3Provider())
  setTimeout(() => {
    set(getInjectedWeb3Provider())
  }, 500)
}

const SupportedWallets = [
  {
    key: 'polkadot-js',
    icon: "data:image/svg+xml,%3c%3fxml version='1.0' encoding='utf-8' standalone='yes'%3f%3e%3csvg xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' version='1.1' id='Layer_1' x='0px' y='0px' viewBox='15 15 140 140' style='enable-background:new 0 0 170 170%3bzoom: 1%3b' xml:space='preserve'%3e%3cstyle type='text/css'%3e.bg0%7bfill:%23FF8C00%7d .st0%7bfill:white%7d%3c/style%3e%3cg%3e%3ccircle class='bg0' cx='85' cy='85' r='70'%3e%3c/circle%3e%3cg%3e%3cpath class='st0' d='M85%2c34.7c-20.8%2c0-37.8%2c16.9-37.8%2c37.8c0%2c4.2%2c0.7%2c8.3%2c2%2c12.3c0.9%2c2.7%2c3.9%2c4.2%2c6.7%2c3.3c2.7-0.9%2c4.2-3.9%2c3.3-6.7 c-1.1-3.1-1.6-6.4-1.5-9.7C58.1%2c57.6%2c69.5%2c46%2c83.6%2c45.3c15.7-0.8%2c28.7%2c11.7%2c28.7%2c27.2c0%2c14.5-11.4%2c26.4-25.7%2c27.2 c0%2c0-5.3%2c0.3-7.9%2c0.7c-1.3%2c0.2-2.3%2c0.4-3%2c0.5c-0.3%2c0.1-0.6-0.2-0.5-0.5l0.9-4.4L81%2c73.4c0.6-2.8-1.2-5.6-4-6.2 c-2.8-0.6-5.6%2c1.2-6.2%2c4c0%2c0-11.8%2c55-11.9%2c55.6c-0.6%2c2.8%2c1.2%2c5.6%2c4%2c6.2c2.8%2c0.6%2c5.6-1.2%2c6.2-4c0.1-0.6%2c1.7-7.9%2c1.7-7.9 c1.2-5.6%2c5.8-9.7%2c11.2-10.4c1.2-0.2%2c5.9-0.5%2c5.9-0.5c19.5-1.5%2c34.9-17.8%2c34.9-37.7C122.8%2c51.6%2c105.8%2c34.7%2c85%2c34.7z M87.7%2c121.7 c-3.4-0.7-6.8%2c1.4-7.5%2c4.9c-0.7%2c3.4%2c1.4%2c6.8%2c4.9%2c7.5c3.4%2c0.7%2c6.8-1.4%2c7.5-4.9C93.3%2c125.7%2c91.2%2c122.4%2c87.7%2c121.7z'%3e%3c/path%3e%3c/g%3e%3c/g%3e%3c/svg%3e",
    name: 'Polkadot.js',
    downloadUrl:
      'https://chrome.google.com/webstore/detail/polkadot%7Bjs%7D-extension/mopnmbcafieddcagagdcbnhejhlodfdd/related',
  },
]

export const walletListAtom = atom((get) => {
  const availables = fromPairs(get(availableWeb3ProvidersAtom))
  return SupportedWallets.map((wallet) => {
    return {
      ...wallet,
      installed: !!availables[wallet.key],
      version: availables[wallet.key],
    }
  })
})

export const useRestoreLastSelectedAccount = () => {
  const restoreAccount = useSetAtom(currentAccountAtom)
  const prepareKeyring = useSetAtom(keyringInstanceAtom)
  useEffect(() => {
    ;(async () => {
      prepareKeyring(RESET)
      await new Promise((i) => setTimeout(i, 100))
      restoreAccount(RESET)
    })()
  }, [restoreAccount, prepareKeyring])
}

export const useWeb3AccountsAccessGrant = () => {
  const setSelectedWeb3Provider = useSetAtom(selectedWeb3ProviderAtom)
  const setAvailableAccounts = useSetAtom(availableAccountsAtom)
  const setAccountsLoading = useSetAtom(accountsLoadingAtom)
  const keyring = useAtomValue(keyringInstanceAtom)
  const grantPrompt = useCallback(
    async (name: string) => {
      setAccountsLoading(true)
      const accounts = await getAllAcountsForProvider(name, keyring!)
      setAccountsLoading(false)
      setSelectedWeb3Provider(name)
      setAvailableAccounts(accounts)
    },
    [setSelectedWeb3Provider, setAvailableAccounts, keyring, setAccountsLoading]
  )
  return grantPrompt
}

const ActionButton = ({
  onClick,
  href,
  children,
}: PropsWithChildren<{
  onClick?: () => void
  href?: string
}>) => {
  const preset = !href
    ? { onClick }
    : {
        href,
        target: '_blank',
        rel: 'noopener noreferer',
      }
  return (
    <Button
      {...preset}
      as={href ? 'a' : 'button'}
      display="flex"
      flex="row"
      justifyContent="space-between"
      p="4"
      h="auto"
      variant={'secondary'}
      borderColor=""
    >
      {children}
    </Button>
  )
}

interface WalletProviderCellProps {
  src: string
  name: string
  version?: string
  onClick?: () => void
  installed?: boolean
  downloadUrl: string
}

const WalletProviderCell = ({
  src,
  name,
  version,
  onClick,
  installed,
  downloadUrl,
}: WalletProviderCellProps) => {
  return (
    <ActionButton href={installed ? undefined : downloadUrl} onClick={onClick}>
      <div className="flex flex-row items-center gap-2">
        <Avatar src={src} size="sm" />
        {name}
        {!!version && (
          <sub className="text-gray-300 font-extralight ml-0.5">{version}</sub>
        )}
      </div>
      {installed ? <BsArrowRight /> : <BsDownload />}
    </ActionButton>
  )
}

export const WalletSelectModal = () => {
  const [visible, setVisible] = useAtom(walletSelectModalVisibleAtom)
  const setAccountSelectModalVisible = useSetAtom(accountSelectModalVisibleAtom)
  const wallets = useAtomValue(walletListAtom)
  const grant = useWeb3AccountsAccessGrant()
  return (
    <Modal isOpen={visible} onClose={() => setVisible(false)}>
      <ModalOverlay />
      <ModalContent className="xl:min-w-[540px]">
        <ModalHeader>Select Wallet</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Stack gap="0" my="2">
            {wallets.map((wallet) => (
              <WalletProviderCell
                key={wallet.key}
                src={wallet.icon}
                name={wallet.name}
                version={wallet.version}
                downloadUrl={wallet.downloadUrl}
                installed={wallet.installed}
                onClick={() => {
                  grant(wallet.key)
                  setVisible(false)
                  setAccountSelectModalVisible(true)
                }}
              />
            ))}
          </Stack>
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}

export const AccountSelectModal = () => {
  const [visible, setVisible] = useAtom(accountSelectModalVisibleAtom)
  const setWalletSelectModalVisible = useSetAtom(walletSelectModalVisibleAtom)
  const accounts = useAtomValue(availableAccountsAtom)
  const accountsLoading = useAtomValue(accountsLoadingAtom)
  const [selected, setSelected] = useAtom(currentAccountAtom)
  return (
    <Modal isOpen={visible} onClose={() => setVisible(false)}>
      <ModalOverlay />
      <ModalContent className="xl:min-w-[540px]">
        <ModalHeader>Select Account</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <div className="flex flex-col gap-4 my-2">
            <div>
              <Button
                size="xs"
                onClick={() => {
                  setVisible(false)
                  setWalletSelectModalVisible(true)
                }}
              >
                Switch Wallet
              </Button>
            </div>
            {accountsLoading ? (
              <div className="w-full flex items-center justify-center pb-4">
                <Spinner />
              </div>
            ) : accounts.length === 0 ? (
              <p className="mb-2 text-sm text-gray-300">
                No Account Available.
              </p>
            ) : (
              <div className="flex flex-col gap-4 pl-1 max-h-80 overflow-y-scroll">
                {accounts.map((account) => (
                  <div
                    className="flex flex-row justify-between items-center p-2 border border-solid border-gray-800 rounded-sm hover:border-phala"
                    key={account.address}
                  >
                    <div>
                      <strong>{account.name}</strong>
                      <small className="ml-1 text-gray-400 font-mono">
                        {account.address.substring(0, 6)}...
                        {account.address.substring(account.address.length - 6)}
                      </small>
                    </div>
                    {selected && selected.address === account.address ? (
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelected(null)
                          setVisible(false)
                        }}
                      >
                        Unselect
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelected(account)
                          setVisible(false)
                        }}
                      >
                        Select
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}
