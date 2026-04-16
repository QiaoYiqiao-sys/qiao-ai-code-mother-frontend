<template>
  <main class="page">
    <section class="page-header">
      <div>
        <h1 class="page-title">用户管理</h1>
        <p class="page-subtitle">查看和管理系统中的所有用户账号。</p>
      </div>
    </section>

    <section class="page-content">
      <a-card :bordered="false" class="search-card">
        <a-form layout="inline">
          <a-form-item label="账号">
            <a-input
              v-model:value="searchForm.userAccount"
              allow-clear
              placeholder="输入账号搜索"
            />
          </a-form-item>
          <a-form-item label="用户名">
            <a-input v-model:value="searchForm.userName" allow-clear placeholder="输入用户名搜索" />
          </a-form-item>
          <a-form-item label="角色">
            <a-select
              v-model:value="searchForm.userRole"
              allow-clear
              placeholder="选择角色"
              style="min-width: 140px"
            >
              <a-select-option v-for="(label, value) in UserRoleLabels" :key="value" :value="value">{{ label }}</a-select-option>
            </a-select>
          </a-form-item>
          <a-form-item>
            <a-space>
              <a-button type="primary" @click="handleSearch">搜索</a-button>
            </a-space>
          </a-form-item>
        </a-form>
      </a-card>

      <a-card :bordered="false" class="table-card">
        <a-table
          :columns="columns"
          :data-source="dataSource"
          :loading="loading"
          row-key="id"
          :pagination="{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showTotal: (total: number) => `共 ${total} 条`,
            showSizeChanger: true,
          }"
          @change="handleTableChange"
        >
          <template #userAvatar="{ record }">
            <a-avatar :src="record.userAvatar" :size="32">
              {{ record.userName?.[0] || record.userAccount?.[0] || '用' }}
            </a-avatar>
          </template>
          <template #actions="{ record }">
            <a-space>
              <a-button type="link" size="small" @click="openEdit(record)">编辑</a-button>
              <a-button type="link" size="small" danger @click="handleDelete(record)">
                删除
              </a-button>
            </a-space>
          </template>
        </a-table>
      </a-card>

      <a-modal
        v-model:open="editModalVisible"
        title="编辑用户"
        :confirm-loading="editLoading"
        @ok="handleEditOk"
        @cancel="handleEditCancel"
      >
        <a-form layout="vertical">
          <a-form-item label="用户名">
            <a-input v-model:value="editForm.userName" placeholder="请输入用户名" />
          </a-form-item>
          <a-form-item label="用户简介">
            <a-textarea
              v-model:value="editForm.userProfile"
              :rows="3"
              placeholder="请输入用户简介"
            />
          </a-form-item>
          <a-form-item label="角色">
            <a-select v-model:value="editForm.userRole" placeholder="选择角色" allow-clear>
              <a-select-option v-for="(label, value) in UserRoleLabels" :key="value" :value="value">{{ label }}</a-select-option>
            </a-select>
          </a-form-item>
        </a-form>
      </a-modal>
    </section>
  </main>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'
import { message, Modal } from 'ant-design-vue'
import type { TableColumnsType } from 'ant-design-vue'
import { listUserVoByPage, updateUser, deleteUser } from '@/api/userController.ts'
import { UserRoleLabels } from '@/enums'

const loading = ref(false)

const searchForm = reactive<Pick<API.UserQueryRequest, 'userAccount' | 'userName' | 'userRole'>>({
  userAccount: '',
  userName: '',
  userRole: '',
})

const pagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
})

const dataSource = ref<API.UserVO[]>([])

const columns: TableColumnsType = [
  {
    title: 'ID',
    dataIndex: 'id',
    width: 120,
  },
  {
    title: '账号',
    dataIndex: 'userAccount',
    ellipsis: true,
  },
  {
    title: '用户名',
    dataIndex: 'userName',
    ellipsis: true,
  },
  {
    title: '头像',
    dataIndex: 'userAvatar',
    width: 90,
    slots: { customRender: 'userAvatar' },
  },
  {
    title: '简介',
    dataIndex: 'userProfile',
    ellipsis: true,
  },
  {
    title: '角色',
    dataIndex: 'userRole',
    width: 80,
  },
  {
    title: '创建时间',
    dataIndex: 'createTime',
    ellipsis: true,
  },
  {
    title: '操作',
    key: 'actions',
    width: 160,
    slots: { customRender: 'actions' },
  },
]

const loadData = async () => {
  try {
    loading.value = true
    const body: API.UserQueryRequest = {
      pageNum: pagination.current,
      pageSize: pagination.pageSize,
      userAccount: searchForm.userAccount || undefined,
      userName: searchForm.userName || undefined,
      userRole: searchForm.userRole || undefined,
    }
    const res = await listUserVoByPage(body)
    const { data } = res
    if (data.code === 0 && data.data) {
      const page = data.data
      dataSource.value = page.records || []
      pagination.total = page.totalRow || 0
    } else {
      message.error(data.message || '获取用户列表失败')
    }
  } catch (e) {
    message.error('获取用户列表异常，请稍后重试')
  } finally {
    loading.value = false
  }
}

const handleTableChange = (pager: any) => {
  pagination.current = pager.current
  pagination.pageSize = pager.pageSize
  loadData()
}

const handleSearch = () => {
  pagination.current = 1
  loadData()
}

// 清空某个搜索条件时，自动回到第一页并刷新列表
watch(
  () => searchForm.userAccount,
  (val, oldVal) => {
    if (!val && oldVal) {
      pagination.current = 1
      loadData()
    }
  },
)

watch(
  () => searchForm.userName,
  (val, oldVal) => {
    if (!val && oldVal) {
      pagination.current = 1
      loadData()
    }
  },
)

watch(
  () => searchForm.userRole,
  (val, oldVal) => {
    if (!val && oldVal) {
      pagination.current = 1
      loadData()
    }
  },
)

const editModalVisible = ref(false)
const editLoading = ref(false)

const editForm = reactive<API.UserUpdateRequest>({
  id: undefined,
  userName: '',
  userAvatar: '',
  userProfile: '',
  userRole: '',
})

const openEdit = (record: API.UserVO) => {
  editForm.id = record.id
  editForm.userName = record.userName || ''
  editForm.userAvatar = record.userAvatar || ''
  editForm.userProfile = record.userProfile || ''
  editForm.userRole = record.userRole || ''
  editModalVisible.value = true
}

const handleEditOk = async () => {
  if (!editForm.id) {
    editModalVisible.value = false
    return
  }
  try {
    editLoading.value = true
    const body: API.UserUpdateRequest = {
      id: editForm.id,
      userName: editForm.userName || undefined,
      userAvatar: editForm.userAvatar || undefined,
      userProfile: editForm.userProfile || undefined,
      userRole: editForm.userRole || undefined,
    }
    const res = await updateUser(body)
    const { data } = res
    if (data.code === 0) {
      message.success('用户信息已更新')
      editModalVisible.value = false
      loadData()
    } else {
      message.error(data.message || '更新失败，请稍后重试')
    }
  } catch (e) {
    message.error('更新异常，请稍后重试')
  } finally {
    editLoading.value = false
  }
}

const handleEditCancel = () => {
  editModalVisible.value = false
}

const handleDelete = (record: API.UserVO) => {
  if (!record.id) {
    return
  }
  Modal.confirm({
    title: '确认删除该用户？',
    content: '删除后不可恢复，请谨慎操作。',
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    async onOk() {
      try {
        const res = await deleteUser({ id: record.id! })
        const { data } = res
        if (data.code === 0) {
          message.success('删除成功')
          loadData()
        } else {
          message.error(data.message || '删除失败，请稍后重试')
        }
      } catch (e) {
        message.error('删除异常，请稍后重试')
      }
    },
  })
}

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
}

.page-title {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  color: #F0EAE3;
}

.page-subtitle {
  margin: 6px 0 0;
  font-size: 13px;
  color: #A89B8C;
}

.page-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.search-card,
.table-card {
  background: transparent;
  border-radius: 16px;
}

.search-card :deep(.ant-form-item-label > label) {
  color: #F0EAE3;
}

.search-card :deep(.ant-input),
.search-card :deep(.ant-select-selector) {
  background: #FFFFFF;
  border-color: #E8E0D8;
  color: #231F1B;
}

.search-card :deep(.ant-input::placeholder),
.search-card :deep(.ant-select-selection-placeholder) {
  color: #A89B8C;
}

.table-card :deep(.ant-table) {
  background: transparent;
  color: #F0EAE3;
}

.table-card :deep(.ant-table-thead > tr > th) {
  background: rgba(26, 23, 20, 0.95);
  color: #A89B8C;
  border-bottom-color: rgba(61, 54, 48, 0.9);
}

.table-card :deep(.ant-table-tbody > tr > td) {
  border-bottom-color: rgba(46, 41, 36, 0.9);
}

.table-card :deep(.ant-table-tbody > tr:hover > td) {
  background: rgba(46, 41, 36, 0.9);
}

.table-card :deep(.ant-btn-link),
.table-card :deep(.ant-btn-link:hover),
.table-card :deep(.ant-btn-link:focus) {
  background: transparent;
  color: #F0EAE3;
  padding: 0;
  height: auto;
}

:deep(.ant-modal) .ant-modal-content {
  background: rgba(35, 31, 27, 0.98);
  border-radius: 18px;
}

:deep(.ant-modal) .ant-modal-header {
  background: transparent;
  border-bottom-color: rgba(61, 54, 48, 0.9);
}

:deep(.ant-modal) .ant-modal-title {
  color: #F0EAE3;
}

:deep(.ant-modal) .ant-modal-body {
  color: #F0EAE3;
}

:deep(.ant-modal) .ant-form-item-label > label {
  color: #F0EAE3;
}

:deep(.ant-modal) .ant-input,
:deep(.ant-modal) .ant-input-textarea-affix-wrapper,
:deep(.ant-modal) .ant-select-selector {
  background: rgba(35, 31, 27, 0.9);
  border-color: rgba(168, 155, 140, 0.6);
  color: #F0EAE3;
}

:deep(.ant-modal) .ant-input::placeholder,
:deep(.ant-modal) .ant-select-selection-placeholder {
  color: #7A6E62;
}
</style>
